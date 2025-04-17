import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import "nextra-theme-docs/style.css";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "../globals.css";
import { fonts } from "../font/setup";

import { PostHogProvider } from "@/analytics/posthog-provider";
import { CookieConsent } from "@/components/cookie-consent";
import { GTProvider } from "gt-next";
import { NextraLayout } from "@/components/nextra-layout";

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
  // const pageMap = await getPageMap(`/${locale || "en"}`);
  const pageMap = await getPageMap(`/en`);
  return (
    <html
      lang={locale || "en"}
      dir="ltr"
      className={cn(
        "antialiased",
        fonts.geistMono.variable,
        fonts.inter.variable,
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
            <NextraLayout locale={locale} pageMap={pageMap}>
              {children}
            </NextraLayout>
          </PostHogProvider>
          <Toaster />
          <CookieConsent />
        </GTProvider>
      </body>
      <Analytics />
    </html>
  );
}
