import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SchoolRun OS",
  description: "School emails in. Family plan out.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
