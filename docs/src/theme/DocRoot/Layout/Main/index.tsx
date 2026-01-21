import React, { type ReactNode } from "react";
import clsx from "clsx";
import { useDocsSidebar } from "@docusaurus/plugin-content-docs/client";
import type { Props } from "@theme/DocRoot/Layout/Main";
import { useChatbotSidebar } from "../ChatbotSidebar/context";

import styles from "./styles.module.css";

export default function DocRootLayoutMain({
  hiddenSidebarContainer,
  children,
}: Props): ReactNode {
  const sidebar = useDocsSidebar();
  const { isHidden: hiddenChatbotSidebar } = useChatbotSidebar();

  return (
    <main
      className={clsx(
        styles.docMainContainer,
        (hiddenSidebarContainer || !sidebar) && styles.docMainContainerEnhanced,
        hiddenChatbotSidebar && styles.docMainContainerChatbotHidden,
        "doc-main-container",
        // TODO: Remove again once banner is away
        "flex-col justify-start!",
      )}
    >
      <div className="bg-green-50 dark:bg-green-600/10 py-2 px-4 border-b-[0.5px] border-green-200 dark:border-green-900">
        <div className="text-center lg:text-left lg:max-w-250 lg:mx-auto lg:px-4 text-[--mastra-text-secondary]!">
          Mastra 1.0 is available 🎉{" "}
          <a
            href="https://mastra.ai/blog/announcing-mastra-1"
            target="_blank"
            className="ml-4 underline! text-green-700! hover:no-underline! dark:text-green-400!"
          >
            Read announcement
          </a>
        </div>
      </div>
      <div
        className={clsx(
          "container padding-top--md padding-bottom--lg",
          styles.docItemWrapper,
          hiddenSidebarContainer && styles.docItemWrapperEnhanced,
          hiddenChatbotSidebar && styles.docItemWrapperChatbotHidden,
        )}
      >
        {children}
      </div>
    </main>
  );
}
