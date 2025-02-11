import { Analytics } from "@vercel/analytics/next";

import localFont from "next/font/local";

import "../global.css";

const geistSans = localFont({
  src: "./font/GeistVF.woff",
  variable: "--font-geist-sans",
});

const commitMono = localFont({
  src: "./font/CommitMono-400-Regular.otf",
  variable: "--font-commit-mono",
});

export default function Nextra({ Component, pageProps }) {
  return (
    <>
      <style jsx global>{`
        html {
          font-family: ${geistSans.style.fontFamily};
        }
      `}</style>

      <main
        className={`${geistSans.variable} ${commitMono.variable} font-sans`}
      >
        <Component {...pageProps} />
      </main>
      <Analytics />
    </>
  );
}
