import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The Pandai DS face, used only by the AskPBot surfaces (app/pbot-host.css).
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AskPBot — a friendly AI assistant",
  description:
    "PBot is a warm, general-purpose AI chat assistant built on Claude, with streaming replies, tool use, and guardrails.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#14140f" },
  ],
};

// Typed explicitly rather than with Next's generated `LayoutProps<"/">`, so
// `npm run typecheck` passes on a clean checkout with no .next/types present.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      // `btn-gamefeel` is where the source DS stages its push-button motion
      // tokens (press depth, release spring) — it sits on <html> there too.
      className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} btn-gamefeel h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
