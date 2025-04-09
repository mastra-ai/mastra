import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Layout } from "nextra-theme-docs";
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
import { TabSwitcher } from "@/components/tab-switcher";

const footer = <Footer />;

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
            navbar={
              <div className="flex  sticky top-0 z-30 bg-[var(--primary-bg)] flex-col">
                <Nav />
                <TabSwitcher />
              </div>
            }
            pageMap={await getPageMap()}
            nextThemes={{
              forcedTheme: "dark",
            }}
            toc={{
              extraContent: (
                <div className="flex flex-col">
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
