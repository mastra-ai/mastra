import { fonts } from "@/app/font/setup";
import "@/app/globals.css";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import "nextra-theme-docs/style.css";
import { getPageMap } from "nextra/page-map";
import { cookies } from "next/headers";

import { PostHogProvider } from "@/analytics/posthog-provider";
import { CookieConsent } from "@/components/cookie/cookie-consent";
import { CustomHead } from "@/components/custom-head";
import { NextraLayout } from "@/components/nextra-layout";
import { NuqsAdapter } from "nuqs/adapters/next/app";

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
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve locale from cookie set by Next.js i18n
  const locale = cookies().get("NEXT_LOCALE")?.value ?? "en";
  let pageMap = await getPageMap();

  const stars = await fetchStars();

  return (
    <html
      lang={locale}
      dir="ltr"
      className={cn(
        "antialiased",
        fonts.geistMono.variable,
        fonts.inter.variable,
        fonts.tasa.variable,
      )}
      suppressHydrationWarning
    >
      <CustomHead />

      <body>
        <PostHogProvider>
          <NextraLayout stars={stars} pageMap={pageMap} locale={locale}>
            <NuqsAdapter>{children}</NuqsAdapter>
          </NextraLayout>
        </PostHogProvider>
        <Toaster />
        <CookieConsent />
        <Analytics />
      </body>
    </html>
  );
}
