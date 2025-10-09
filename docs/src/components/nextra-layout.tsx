"use client";
import { usePathname } from "next/navigation";
import { PageMapItem } from "nextra";
import { Layout } from "nextra-theme-docs";
import { Footer } from "./footer";
import { Nav } from "./navbar";
import { SearchWrapper } from "./search-wrapper";
import { SubscribeForm } from "./subscribe-form";
import { TabSwitcher } from "./tab-switcher";
import { FeedbackTrigger } from "./feedback-trigger";

const footer = <Footer />;

export const NextraLayout = ({
  pageMap,
  children,
  locale = "en",
  stars,
}: {
  pageMap: PageMapItem[];
  children: React.ReactNode;
  locale?: string;
  stars: number;
}) => {
  const pathname = usePathname();
  const isReference = pathname.includes("/reference");
  // Ensure Nextra receives locale in the route for search and sidebar highlighting
  // This relies on Next.js i18n configured in next.config and cookie-based locale
  return (
    <Layout
      search={<SearchWrapper locale={locale} />}
      navbar={
        <div className="flex  sticky top-0 z-30 bg-light-color-surface-15 dark:bg-[var(--primary-bg)] flex-col">
          <Nav stars={stars} locale={locale} />
          <TabSwitcher />
        </div>
      }
      pageMap={pageMap}
      toc={{
        title: "On This Page",
        // title: <T id="_locale_.layout.toc">On This Page</T>,
        extraContent: (
          <div className="flex gap-3 flex-col">
            <SubscribeForm
              className="pt-[1.5rem] mt-0 md:flex-col"
              placeholder="you@company.com"
            />
            <FeedbackTrigger />
          </div>
        ),
      }}
      nextThemes={{
        attribute: "class",
      }}
      docsRepositoryBase="https://github.com/mastra-ai/mastra/blob/main/docs"
      // footer={footer}
      sidebar={{
        autoCollapse: true,
        defaultMenuCollapseLevel: isReference ? 1 : 3,
      }}
      feedback={{
        content: null,
      }}
      editLink={<>Edit this page</>}

      // editLink={<T id="_locale_.layout.edit_link">Edit this page</T>}

      // ... Your additional layout options
    >
      {children}
    </Layout>
  );
};
