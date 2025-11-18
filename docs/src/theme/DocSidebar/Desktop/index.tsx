import { useThemeConfig } from "@docusaurus/theme-common";
import type { Props } from "@theme/DocSidebar/Desktop";
import CollapseButton from "@theme/DocSidebar/Desktop/CollapseButton";
import Content from "@theme/DocSidebar/Desktop/Content";
import Logo from "@theme/Logo";
import clsx from "clsx";
import React from "react";

import { ThemeSwitcher } from "@site/src/components/theme-switcher";

import styles from "./styles.module.css";
import VersionControl from "@site/src/components/version-control";

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
      <div className="mr-[7px] my-4 mb-2">
        <VersionControl />
      </div>
      {hideOnScroll && <Logo tabIndex={-1} className={styles.sidebarLogo} />}
      <Content path={path} sidebar={sidebar} />
      <footer className="py-2 pr-0.5 mr-4 flex justify-end border-t-[0.5px] border-(--border)">
        <ThemeSwitcher />
      </footer>
      {hideable && <CollapseButton onClick={onCollapse} />}
    </div>
  );
}

export default React.memo(DocSidebarDesktop);
