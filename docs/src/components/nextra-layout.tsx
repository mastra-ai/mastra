"use client";
import { T } from "gt-next/client";
import { usePathname, useSearchParams } from "next/navigation";
import { PageMapItem } from "nextra";
import { Layout } from "nextra-theme-docs";
import { FeedbackTrigger } from "./feedback-trigger";
import { FloatingChatWidget } from "./floating-chat-widget";
import { Footer } from "./footer";
import { Nav } from "./navbar";
import { SearchWrapper } from "./search-wrapper";
import { SubscribeForm } from "./subscribe-form";
import { TabSwitcher } from "./tab-switcher";

const footer = <Footer />;

export const NextraLayout = ({
  pageMap,
  children,
  locale,
  stars,
  isKapaChatbotEnabled: serverIsKapaChatbotEnabled,
}: {
  pageMap: PageMapItem[];
  children: React.ReactNode;
  locale: string;
  stars: number;
  isKapaChatbotEnabled: boolean;
}) => {
  const pathname = usePathname();
  const isReference = pathname.includes("/reference");
  const searchParams = useSearchParams();

  // Check if vnext_search URL param is set to override the server-side flag
  const vnextSearch = searchParams.get("vnext_search");
  const isKapaChatbotEnabled =
    vnextSearch === "true" ? true : serverIsKapaChatbotEnabled;

  return (
    <>
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
            <div className="flex flex-col gap-3">
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

      {/* Floating chat widget */}
      <FloatingChatWidget isKapaChatbotEnabled={isKapaChatbotEnabled} />
    </>
  );
};
