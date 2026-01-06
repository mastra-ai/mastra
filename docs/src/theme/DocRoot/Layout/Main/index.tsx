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
      )}
    >
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
