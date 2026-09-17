import type { Metadata, Viewport } from "next";
import "@fontsource-variable/outfit";
import "@fontsource-variable/jetbrains-mono";
import "../src/styles.css";

export const metadata: Metadata = {
  title: "What Can I Cook?",
  description: "Turn photos of your fridge into practical recipe ideas you can cook tonight.",
};

export const viewport: Viewport = {
  themeColor: "#011A16",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
