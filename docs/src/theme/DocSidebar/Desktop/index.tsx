import React from "react";
import clsx from "clsx";
import { useThemeConfig } from "@docusaurus/theme-common";
import Logo from "@theme/Logo";
import CollapseButton from "@theme/DocSidebar/Desktop/CollapseButton";
import Content from "@theme/DocSidebar/Desktop/Content";
import type { Props } from "@theme/DocSidebar/Desktop";

import styles from "./styles.module.css";
import LocaleControl from "@site/src/components/gt/LocaleControl";
import { GithubStarCount } from "@site/src/components/github-star-count";

function DocSidebarDesktop({ path, sidebar, onCollapse, isHidden }: Props) {
  const {
    navbar: { hideOnScroll },
    docs: {
      sidebar: { hideable },
    },
  } = useThemeConfig();

  return (
    <div
      className={clsx(
        styles.sidebar,
        hideOnScroll && styles.sidebarWithHideableNavbar,
        isHidden && styles.sidebarHidden,
      )}
    >
      {hideOnScroll && <Logo tabIndex={-1} className={styles.sidebarLogo} />}
      <Content path={path} sidebar={sidebar} />
      <footer className="py-4 pr-2 flex items-center border-t-[0.5px] border-(--border)">
        <GithubStarCount />
        <LocaleControl
          size="sm"
          className="px-[13px] gap-1.5 text-xs w-fit bg-(--mastra-surface-3) dark:bg-(--mastra-surface-1)/50 border-none rounded-lg transition-colors cursor-pointer"
        />
      </footer>
      {hideable && <CollapseButton onClick={onCollapse} />}
    </div>
  );
}

export default React.memo(DocSidebarDesktop);
