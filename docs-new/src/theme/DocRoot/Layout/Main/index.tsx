import React, { type ReactNode } from "react";
import clsx from "clsx";
import { useDocsSidebar } from "@docusaurus/plugin-content-docs/client";
import type { Props } from "@theme/DocRoot/Layout/Main";

import styles from "./styles.module.css";

interface ExtendedProps extends Props {
  hiddenChatbotSidebar?: boolean;
}

export default function DocRootLayoutMain({
  hiddenSidebarContainer,
  hiddenChatbotSidebar,
  children,
}: ExtendedProps): ReactNode {
  const sidebar = useDocsSidebar();
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
