import { Analytics } from "@vercel/analytics/next";
import Head from "next/head";

import localFont from "next/font/local";

import "../global.css";

const domain = process.env.NEXT_PUBLIC_APP_URL;

const geistSans = localFont({
  src: "./font/GeistVF.woff",
  variable: "--font-geist-sans",
});

const commitMono = localFont({
  src: "./font/CommitMono-400-Regular.otf",
  variable: "--font-commit-mono",
});

export default function Nextra({ Component, pageProps }) {
  const { frontMatter = {} } = pageProps;
  const title = frontMatter.title || "Default Title";
  const description = frontMatter.description || "Default description";
  const ogImage =
    frontMatter.ogImage ||
    `${domain}/api/og?title=${encodeURIComponent(title)}`;

  return (
    <>
      <Head>
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={ogImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
      </Head>

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
