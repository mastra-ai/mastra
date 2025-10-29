import React, { type ReactNode } from "react";
import { translate } from "@docusaurus/Translate";
import IconArrow from "@theme/Icon/Arrow";
import type { Props } from "@theme/DocRoot/Layout/Sidebar/ExpandButton";

import styles from "./styles.module.css";

export default function ChatbotExpandButton({
  toggleSidebar,
}: Props): ReactNode {
  return (
    <div
      className={styles.expandButton}
      title={translate({
        id: "theme.docs.chatbot.expandButtonTitle",
        message: "Expand chatbot",
        description:
          "The ARIA label and title attribute for expand button of chatbot sidebar",
      })}
      aria-label={translate({
        id: "theme.docs.chatbot.expandButtonAriaLabel",
        message: "Expand chatbot",
        description:
          "The ARIA label and title attribute for expand button of chatbot sidebar",
      })}
      tabIndex={0}
      role="button"
      onKeyDown={toggleSidebar}
      onClick={toggleSidebar}
    >
      <IconArrow className={styles.expandButtonIcon} />
    </div>
  );
}
