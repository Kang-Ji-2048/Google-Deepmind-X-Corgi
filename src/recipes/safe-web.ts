import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import type { IncomingHttpHeaders } from "node:http";

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type HostResolver = (hostname: string) => Promise<readonly ResolvedAddress[]>;

export interface RawWebResponse {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: Uint8Array;
}

export type PinnedRequest = (
  url: URL,
  address: ResolvedAddress,
  options: { timeoutMs: number; maxResponseBytes: number }
) => Promise<RawWebResponse>;

export interface SafeHtmlFetchOptions {
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxRedirects?: number;
  resolveHost?: HostResolver;
  request?: PinnedRequest;
}

const BLOCKED = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4]
] as const) BLOCKED.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
  ["100::", 64], ["2001:db8::", 32]
] as const) BLOCKED.addSubnet(network, prefix, "ipv6");

export function isPublicIpAddress(address: string): boolean {
  if (address.toLowerCase().startsWith("::ffff:")) return false;
  const family = isIP(address);
  if (family === 0) return false;
  return !BLOCKED.check(address, family === 4 ? "ipv4" : "ipv6");
}

async function defaultResolver(hostname: string): Promise<ResolvedAddress[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map(({ address, family }) => ({ address, family: family as 4 | 6 }));
}

const defaultPinnedRequest: PinnedRequest = (url, resolved, options) => new Promise((resolve, reject) => {
  const requester = url.protocol === "https:" ? httpsRequest : httpRequest;
  const request = requester({
    protocol: url.protocol,
    hostname: resolved.address,
    family: resolved.family,
    port: url.port || (url.protocol === "https:" ? 443 : 80),
    path: `${url.pathname}${url.search}`,
    method: "GET",
    servername: url.hostname,
    headers: {
      Host: url.host,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Encoding": "identity",
      "User-Agent": "WhatCanICookRecipeSearch/1.0"
    }
  }, (response) => {
    const announced = Number(response.headers["content-length"] ?? 0);
    if (announced > options.maxResponseBytes) {
      response.destroy();
      reject(new Error("Publisher response exceeds the byte limit"));
      return;
    }
    const chunks: Buffer[] = [];
    let total = 0;
    response.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > options.maxResponseBytes) {
        response.destroy(new Error("Publisher response exceeds the byte limit"));
        return;
      }
      chunks.push(chunk);
    });
    response.on("end", () => resolve({
      statusCode: response.statusCode ?? 0,
      headers: response.headers,
      body: Buffer.concat(chunks)
    }));
    response.on("error", reject);
  });
  request.setTimeout(options.timeoutMs, () => request.destroy(new Error("Publisher request timed out")));
  request.on("error", reject);
  request.end();
});

function validatePublisherUrl(value: string | URL): URL {
  const url = value instanceof URL ? new URL(value) : new URL(value);
  if (url.protocol !== "https:") throw new Error("Publisher URL must use HTTPS");
  if (url.username || url.password) throw new Error("Publisher URL credentials are not allowed");
  if (url.port && url.port !== "443") throw new Error("Publisher URL must use the standard HTTPS port");
  if (isIP(url.hostname) !== 0 || url.hostname === "localhost" || url.hostname.endsWith(".local")) {
    throw new Error("Publisher URL host is not allowed");
  }
  return url;
}

export async function safeFetchPublisherHtml(
  input: string | URL,
  options: SafeHtmlFetchOptions = {}
): Promise<{ finalUrl: string; html: string }> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxResponseBytes = options.maxResponseBytes ?? 1_048_576;
  const maxRedirects = options.maxRedirects ?? 3;
  const resolver = options.resolveHost ?? defaultResolver;
  const request = options.request ?? defaultPinnedRequest;
  let current = validatePublisherUrl(input);
  const visited = new Set<string>();

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    if (visited.has(current.href)) throw new Error("Publisher redirect loop detected");
    visited.add(current.href);
    const addresses = await resolver(current.hostname);
    if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
      throw new Error("Publisher host did not resolve exclusively to public IP addresses");
    }
    const response = await request(current, addresses[0], { timeoutMs, maxResponseBytes });
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      const location = Array.isArray(response.headers.location)
        ? response.headers.location[0]
        : response.headers.location;
      if (!location || redirects === maxRedirects) throw new Error("Publisher redirect limit exceeded");
      current = validatePublisherUrl(new URL(location, current));
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Publisher returned HTTP ${response.statusCode}`);
    }
    const contentType = String(response.headers["content-type"] ?? "").toLowerCase();
    if (!contentType.startsWith("text/html") && !contentType.startsWith("application/xhtml+xml")) {
      throw new Error("Publisher response is not HTML");
    }
    const encoding = String(response.headers["content-encoding"] ?? "identity").toLowerCase();
    if (encoding !== "identity") throw new Error("Compressed publisher responses are not accepted");
    return { finalUrl: current.href, html: new TextDecoder().decode(response.body) };
  }
  throw new Error("Publisher redirect limit exceeded");
}
