"use client";
import { T } from "gt-next/client";
import { usePathname } from "next/navigation";
import { PageMapItem } from "nextra";
import { Layout } from "nextra-theme-docs";
import { Search } from "nextra/components";
import { Footer } from "./footer";
import { Nav } from "./navbar";
import { SubscribeForm } from "./subscribe-form";
import { TabSwitcher } from "./tab-switcher";
const footer = <Footer />;

export const NextraLayout = ({
  pageMap,
  children,
}: {
  pageMap: PageMapItem[];
  children: React.ReactNode;
  locale: string;
}) => {
  const pathname = usePathname();
  const isReference = pathname.includes("/reference");
  return (
    <Layout
      // search={<Search placeholder={getSearchPlaceholder(locale)} />}
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
        title: <T id="_locale_.layout.toc">On This Page</T>,
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
      // i18n={[
      //   { locale: "en", name: "English" },
      //   { locale: "ja", name: "日本語" },
      // ]}
      feedback={{
        content: (
          <T id="_locale_.layout.feedback">Question? Give us feedback</T>
        ),
      }}
      editLink={<T id="_locale_.layout.edit_link">Edit this page</T>}

      // ... Your additional layout options
    >
      {children}
    </Layout>
  );
};
