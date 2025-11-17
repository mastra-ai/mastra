import { useThemeConfig } from "@docusaurus/theme-common";
import type { Props } from "@theme/DocSidebar/Desktop";
import CollapseButton from "@theme/DocSidebar/Desktop/CollapseButton";
import Content from "@theme/DocSidebar/Desktop/Content";
import Logo from "@theme/Logo";
import clsx from "clsx";
import React from "react";

import LocaleControl from "@site/src/components/gt/LocaleControl";
import { ThemeSwitcher } from "@site/src/components/theme-switcher";
import styles from "./styles.module.css";

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
      <footer className="py-4 pr-0.5 mr-4 flex justify-between border-t-[0.5px] border-(--border)">
        <LocaleControl
          size="sm"
          className="px-[13px] w-fit bg-white dark:bg-(--mastra-primary) border-transparent rounded-full transition-colors cursor-pointer"
        />
        <ThemeSwitcher />
      </footer>
      {hideable && <CollapseButton onClick={onCollapse} />}
    </div>
  );
}

export default React.memo(DocSidebarDesktop);
