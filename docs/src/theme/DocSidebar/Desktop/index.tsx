import { useThemeConfig } from '@docusaurus/theme-common'
import type { Props } from '@theme/DocSidebar/Desktop'
import CollapseButton from '@theme/DocSidebar/Desktop/CollapseButton'
import Content from '@theme/DocSidebar/Desktop/Content'
import Logo from '@theme/Logo'
import clsx from 'clsx'
import React from 'react'
import styles from './styles.module.css'
import { InverseCorner } from './InverseCorner'

function DocSidebarDesktop({ path, sidebar, onCollapse, isHidden }: Props) {
  const {
    navbar: { hideOnScroll },
    docs: {
      sidebar: { hideable },
    },
  } = useThemeConfig()
  return (
    <div
      className={clsx(
        styles.sidebar,
        hideOnScroll && styles.sidebarWithHideableNavbar,
        isHidden && styles.sidebarHidden,
      )}
    >
      <InverseCorner
        size="24px"
        fill="var(--ifm-navbar-background-color)"
        borderColor="var(--border)"
        borderWidth={1}
        style={{
          position: 'fixed',
          bottom: 'auto',
          right: 'auto',
          top: 'var(--ifm-navbar-height)',
          left: 'var(--doc-sidebar-width)',
          transform: 'translate(-0.5px, -0.5px)',
        }}
      />
      {hideOnScroll && <Logo tabIndex={-1} className={styles.sidebarLogo} />}
      <Content path={path} sidebar={sidebar} />
      {hideable && <CollapseButton onClick={onCollapse} />}
    </div>
  )
}

export default React.memo(DocSidebarDesktop)
