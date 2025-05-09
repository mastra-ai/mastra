import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import "nextra-theme-docs/style.css";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { fonts } from "../font/setup";
import "../globals.css";

import { PostHogProvider } from "@/analytics/posthog-provider";
import { CookieConsent } from "@/components/cookie-consent";
import { NextraLayout } from "@/components/nextra-layout";
import { GTProvider } from "gt-next";

const fetchStars = async () => {
  try {
    const res = await fetch("https://api.github.com/repos/mastra-ai/mastra", {
      next: { revalidate: 3600 }, // Revalidate every hour
    });
    const data = await res.json();

    return data.stargazers_count;
  } catch (error) {
    console.error(error);
    return 0;
  }
};

export const metadata: Metadata = {
  title: "Docs - The Typescript AI framework - Mastra",
  description:
    "Prototype and productionize AI features with a modern JS/TS stack",
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const pageMap = await getPageMap(`/${locale || "en"}`);
  const stars = await fetchStars();

  return (
    <html
      lang={locale || "en"}
      dir="ltr"
      className={cn(
        "antialiased",
        fonts.geistMono.variable,
        fonts.inter.variable,
        fonts.tasa.variable,
      )}
      suppressHydrationWarning
    >
      <Head
        // primary-color
        color={{
          hue: 143,
          saturation: 97,
          lightness: 54,
        }}
      >
        {/* Your additional tags should be passed as `children` of `<Head>` element */}
      </Head>
      <body>
        <GTProvider locale={locale}>
          <PostHogProvider>
            <NextraLayout stars={stars} locale={locale} pageMap={pageMap}>
              {children}
              {/* {<DocsChat />} */}
            </NextraLayout>
          </PostHogProvider>
          <Toaster />
          <CookieConsent />
        </GTProvider>
        <Analytics />
      </body>
    </html>
  );
}
