"use client";
import { SubscribeForm } from "./subscribe-form";
import { TabSwitcher } from "./tab-switcher";

import { PageMapItem } from "nextra";
import { Layout } from "nextra-theme-docs";
import { Search } from "nextra/components";
import { Nav } from "./navbar";
import { Footer } from "./footer";
import { usePathname } from "next/navigation";
const footer = <Footer />;

export const NextraLayout = ({
  pageMap,
  children,
}: {
  pageMap: PageMapItem[];
  children: React.ReactNode;
}) => {
  const pathname = usePathname();
  const isReference = pathname.includes("/reference");
  return (
    <Layout
      search={<Search placeholder="Search docs" />}
      navbar={
        <div className="flex  sticky top-0 z-30 bg-[var(--primary-bg)] flex-col">
          <Nav />
          <TabSwitcher />
        </div>
      }
      pageMap={pageMap}
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
      sidebar={{
        autoCollapse: true,
        defaultMenuCollapseLevel: isReference ? 1 : 2,
      }}
      // ... Your additional layout options
    >
      {children}
    </Layout>
  );
};
