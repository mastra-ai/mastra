import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/toaster";
import localFont from "next/font/local";
import { PostHogProvider } from "posthog-js/react";
import posthog from "posthog-js";
import { Router } from 'next/router'
import { useEffect, useRef } from 'react'
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
  const oldUrlRef = useRef('')

   useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      // Enable debug mode in development
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') posthog.debug()
      }
    })

    const handleRouteChange = () => posthog?.capture('$pageview')
    const handleRouteChangeStart = () => posthog?.capture('$pageleave', {
      $current_url: oldUrlRef.current
    })


    Router.events.on('routeChangeComplete', handleRouteChange);
    Router.events.on('routeChangeStart', handleRouteChangeStart);


    return () => {
      Router.events.off('routeChangeComplete', handleRouteChange);
      Router.events.off('routeChangeStart', handleRouteChangeStart);
    }
  }, [])
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
        <PostHogProvider
          client={posthog}
        >
          <Component {...pageProps} />
          <Toaster />
        </PostHogProvider>
      </main>
      <Analytics />
    </>
  );
}
