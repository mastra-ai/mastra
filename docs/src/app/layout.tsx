import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Layout, ThemeSwitch } from "nextra-theme-docs";
import "nextra-theme-docs/style.css";
import { Head, Search } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { fonts } from "./font/setup";
import "./globals.css";

import { PostHogProvider } from "@/analytics/posthog-provider";
import { CookieConsent } from "@/components/cookie-consent";
import { Footer } from "@/components/footer";
import { Nav } from "@/components/navbar";
import { SubscribeForm } from "@/components/subscribe-form";

const footer = <Footer />;

export const metadata: Metadata = {
  title: "The Typescript AI framework - Mastra",
  description:
    "Prototype and productionize AI features with a modern JS/TS stack",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
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
        <PostHogProvider>
          <Layout
            search={<Search placeholder="Search docs" />}
            navbar={<Nav />}
            pageMap={await getPageMap()}
            toc={{
              extraContent: (
                <div className="flex flex-col">
                  <ThemeSwitch className="!text-[14px] dark:!text-[#A9A9A9] w-full dark:!bg-[#121212] block rounded-[6px] h-[32px] px-3 flex items-center bg-gray-100" />
                  <SubscribeForm
                    className="pt-[1.5rem] mt-0 md:flex-col"
                    placeholder="you@company.com"
                  />
                </div>
              ),
            }}
            docsRepositoryBase="https://github.com/mastra-ai/mastra/blob/main/docs"
            footer={footer}
            // ... Your additional layout options
          >
            {children}
          </Layout>
        </PostHogProvider>
        <Toaster />
        <CookieConsent />
      </body>
      <Analytics />
    </html>
  );
}
