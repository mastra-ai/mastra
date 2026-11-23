import React, { type ReactNode } from 'react'
import clsx from 'clsx'
import { useNavbarSecondaryMenu } from '@docusaurus/theme-common/internal'
import { ThemeClassNames } from '@docusaurus/theme-common'
import type { Props } from '@theme/Navbar/MobileSidebar/Layout'
import styles from './styles.module.css'

function NavbarMobileSidebarPanel({ children, inert }: { children: ReactNode; inert: boolean }) {
  return (
    <div className={clsx(ThemeClassNames.layout.navbar.mobileSidebar.panel, 'navbar-sidebar__item menu')} inert={inert}>
      {children}
    </div>
  )
}

export default function NavbarMobileSidebarLayout({ header, primaryMenu, secondaryMenu }: Props): ReactNode {
  const { shown: secondaryMenuShown } = useNavbarSecondaryMenu()
  return (
    <div className={clsx(ThemeClassNames.layout.navbar.mobileSidebar.container, 'navbar-sidebar', styles.sidebar)}>
      {header}
      <div
        className={clsx(styles.items, 'navbar-sidebar__items', {
          'navbar-sidebar__items--show-secondary': secondaryMenuShown,
        })}
      >
        <NavbarMobileSidebarPanel inert={secondaryMenuShown}>{primaryMenu}</NavbarMobileSidebarPanel>
        <NavbarMobileSidebarPanel inert={!secondaryMenuShown}>{secondaryMenu}</NavbarMobileSidebarPanel>
      </div>
    </div>
  )
}
