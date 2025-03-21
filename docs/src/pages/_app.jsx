import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/toaster";
import localFont from "next/font/local";
import { Inter } from "next/font/google";

const geistMono = localFont({
  src: "./font/GeistMonoVF.woff",
  variable: "--geist-mono",
  weight: "100 500 900",
});

const inter = Inter({ subsets: ["latin"], variable: "--inter" });

import "../global.css";

export default function Nextra({ Component, pageProps }) {
  return (
    <>
      <style jsx global>{`
        html {
          font-family: ${inter.style.fontFamily};
        }
      `}</style>

      <main className={`${inter.variable} ${geistMono.variable} font-sans`}>
        <Component {...pageProps} />
        <Toaster />
      </main>
      <Analytics />
    </>
  );
}
