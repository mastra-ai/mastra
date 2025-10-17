"use client";
import { KapaProvider } from "@kapaai/react-sdk";
import { T } from "gt-next/client";
import { usePathname, useSearchParams } from "next/navigation";
import { PageMapItem } from "nextra";
import { Layout } from "nextra-theme-docs";
import { usePostHog } from "posthog-js/react";
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
  isChatbotEnabled,
}: {
  pageMap: PageMapItem[];
  children: React.ReactNode;
  locale: string;
  stars: number;
  isChatbotEnabled: boolean;
}) => {
  const pathname = usePathname();
  const posthog = usePostHog();
  const searchParams = useSearchParams();
  const vnext_bot = searchParams.get("vnext_bot");

  const showChatbot = isChatbotEnabled || vnext_bot === "true";

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
          defaultMenuCollapseLevel: pathname.includes("/getting-started")
            ? 3
            : 1,
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
      <KapaProvider
        integrationId={process.env.NEXT_PUBLIC_KAPA_INTEGRATION_ID || ''}
        callbacks={{
          askAI: {
            onQuerySubmit({ question, threadId, conversation }) {
              posthog.capture("DOCS_CHATBOT_QUESTION", {
                question,
                thread_id: threadId,
                conversation_length: conversation.length,
                timestamp: new Date().toISOString(),
                source: "floating_widget",
              });
            },
            onAnswerGenerationCompleted({
              answer,
              question,
              threadId,
              questionAnswerId,
              conversation,
            }) {
              posthog.capture("DOCS_CHATBOT_RESPONSE", {
                answer,
                question,
                question_answer_id: questionAnswerId,
                thread_id: threadId,
                conversation_length: conversation.length,
                answer_length: answer.length,
                timestamp: new Date().toISOString(),
                source: "floating_widget",
              });
            },
          },
        }}
      >
        {showChatbot && <FloatingChatWidget />}
      </KapaProvider>
    </>
  );
};
