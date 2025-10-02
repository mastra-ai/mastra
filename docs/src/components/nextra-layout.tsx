"use client";
import { T } from "gt-next/client";
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
  locale,
  stars,
}: {
  pageMap: PageMapItem[];
  children: React.ReactNode;
  locale: string;
  stars: number;
}) => {
  const pathname = usePathname();
  const isReference = pathname.includes("/reference");
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
        title: <T id="_locale_.layout.toc">On This Page</T>,
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
      footer={footer}
      sidebar={{
        autoCollapse: true,
        defaultMenuCollapseLevel: isReference ? 1 : 3,
      }}
      i18n={[
        { locale: "en", name: "English" },
        { locale: "ja", name: "日本語" },
      ]}
      feedback={{
        content: null,
      }}
      editLink={<T id="_locale_.layout.edit_link">Edit this page</T>}

      // ... Your additional layout options
    >
      {children}
    </Layout>
  );
};
