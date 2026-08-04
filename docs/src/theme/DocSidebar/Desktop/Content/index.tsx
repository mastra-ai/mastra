import React, { type ReactNode, useRef, useState } from 'react'
import clsx from 'clsx'
import { ThemeClassNames } from '@docusaurus/theme-common'
import { useAnnouncementBar, useScrollPosition } from '@docusaurus/theme-common/internal'
import { translate } from '@docusaurus/Translate'
import DocSidebarItems from '@theme/DocSidebarItems'
import type { Props } from '@theme/DocSidebar/Desktop/Content'
import ContextualContent from '../../ContextualContent'
import { useContextualSidebar } from '../../../contextual-sidebar-context'

import styles from './styles.module.css'

function useShowAnnouncementBar() {
  const { isActive } = useAnnouncementBar()
  const [showAnnouncementBar, setShowAnnouncementBar] = useState(isActive)

  useScrollPosition(
    ({ scrollY }) => {
      if (isActive) {
        setShowAnnouncementBar(scrollY === 0)
      }
    },
    [isActive],
  )
  return isActive && showAnnouncementBar
}

export default function DocSidebarDesktopContent({ path, sidebar, className }: Props): ReactNode {
  const showAnnouncementBar = useShowAnnouncementBar()
  const navigationRef = useRef<HTMLElement>(null)
  const { activeSidebar, clearSidebar, getSidebarItems } = useContextualSidebar()
  const contextualItems = getSidebarItems(sidebar)
  const contextualSidebar =
    activeSidebar && contextualItems ? { state: activeSidebar, items: contextualItems } : undefined

  const handleBack = () => {
    clearSidebar()
    requestAnimationFrame(() => navigationRef.current?.focus())
  }

  return (
    <nav
      ref={navigationRef}
      tabIndex={-1}
      data-sidebar-pane={contextualSidebar ? 'contextual' : 'root'}
      aria-label={translate({
        id: 'theme.docs.sidebar.navAriaLabel',
        message: 'Docs sidebar',
        description: 'The ARIA label for the sidebar navigation',
      })}
      className={clsx(
        'menu thin-scrollbar',
        styles.menu,
        showAnnouncementBar && styles.menuWithAnnouncementBar,
        className,
      )}
    >
      {contextualSidebar ? (
        <ContextualContent
          activePath={path}
          items={contextualSidebar.items}
          label={contextualSidebar.state.categoryLabel}
          onBack={handleBack}
        />
      ) : (
        <ul className={clsx(ThemeClassNames.docs.docSidebarMenu, 'menu__list')}>
          <DocSidebarItems items={sidebar} activePath={path} level={1} />
        </ul>
      )}
    </nav>
  )
}
