import type { Metadata, Viewport } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "../src/styles.css";

export const metadata: Metadata = {
  title: "What Can I Cook?",
  description: "Turn photos of your fridge into practical recipe ideas you can cook tonight.",
};

export const viewport: Viewport = {
  themeColor: "#1447d8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
