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
  const oldUrlRef = useRef("");

  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      // Enable debug mode in development
      loaded: (posthog) => {
        if (process.env.NODE_ENV === "development") posthog.debug();
      },
    });

    const handleRouteChange = () => posthog?.capture("$pageview");
    const handleRouteChangeStart = () =>
      posthog?.capture("$pageleave", {
        $current_url: oldUrlRef.current,
      });

    Router.events.on("routeChangeComplete", handleRouteChange);
    Router.events.on("routeChangeStart", handleRouteChangeStart);

    return () => {
      Router.events.off("routeChangeComplete", handleRouteChange);
      Router.events.off("routeChangeStart", handleRouteChangeStart);
    };
  }, []);
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
