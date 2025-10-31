import { useDocsSidebar } from "@docusaurus/plugin-content-docs/client";
import BackToTopButton from "@theme/BackToTopButton";
import type { Props } from "@theme/DocRoot/Layout";
import DocRootLayoutSidebar from "@theme/DocRoot/Layout/Sidebar";
import { lazy, type ReactNode, Suspense, useState } from "react";
import DocRootLayoutMain from "./Main";

import { PulsingDots } from "@site/src/components/loading";
import styles from "./styles.module.css";
const ChatbotSidebar = lazy(() => import("./ChatbotSidebar"));

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
        {!hiddenChatbotSidebar && (
          <Suspense fallback={<PulsingDots />}>
            <ChatbotSidebar
              hiddenChatbotSidebar={hiddenChatbotSidebar}
              setHiddenChatbotSidebar={setHiddenChatbotSidebar}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
