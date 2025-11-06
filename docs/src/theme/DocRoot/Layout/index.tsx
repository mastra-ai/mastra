import React, { type ReactNode, useState } from "react";
import { useDocsSidebar } from "@docusaurus/plugin-content-docs/client";
import BackToTopButton from "@theme/BackToTopButton";
import DocRootLayoutSidebar from "@theme/DocRoot/Layout/Sidebar";
import DocRootLayoutMain from "./Main";
import type { Props } from "@theme/DocRoot/Layout";

import styles from "./styles.module.css";
import ChatbotSidebar from "./ChatbotSidebar";

export default function DocRootLayout({ children }: Props): ReactNode {
  const sidebar = useDocsSidebar();
  const [hiddenSidebarContainer, setHiddenSidebarContainer] = useState(false);
  const [hiddenChatbotSidebar, setHiddenChatbotSidebar] = useState(true);

  return (
    <div className={styles.docsWrapper}>
      <BackToTopButton />
      <div className={styles.docRoot}>
        {sidebar && (
          <DocRootLayoutSidebar
            sidebar={sidebar.items}
            hiddenSidebarContainer={hiddenSidebarContainer}
            setHiddenSidebarContainer={setHiddenSidebarContainer}
          />
        )}
        <DocRootLayoutMain
          hiddenSidebarContainer={hiddenSidebarContainer}
          hiddenChatbotSidebar={hiddenChatbotSidebar}
        >
          {children}
        </DocRootLayoutMain>
        <ChatbotSidebar
          hiddenChatbotSidebar={hiddenChatbotSidebar}
          setHiddenChatbotSidebar={setHiddenChatbotSidebar}
        />
      </div>
    </div>
  );
}
