import React, { useRef } from 'react'
import clsx from 'clsx'
import { NavbarSecondaryMenuFiller, type NavbarSecondaryMenuComponent, ThemeClassNames } from '@docusaurus/theme-common'
import { useNavbarMobileSidebar } from '@docusaurus/theme-common/internal'
import DocSidebarItems from '@theme/DocSidebarItems'
import type { Props } from '@theme/DocSidebar/Mobile'
import type { PropSidebarItem } from '@docusaurus/plugin-content-docs'
import ContextualContent from '../ContextualContent'
import { useContextualSidebar } from '../../contextual-sidebar-context'

// eslint-disable-next-line react/function-component-definition
const DocSidebarMobileSecondaryMenu: NavbarSecondaryMenuComponent<Props> = ({ sidebar, path }) => {
  const mobileSidebar = useNavbarMobileSidebar()
  const navigationRef = useRef<HTMLDivElement>(null)
  const { activeSidebar, clearSidebar, getSidebarItems } = useContextualSidebar()
  const contextualItems = getSidebarItems(sidebar)
  const contextualSidebar =
    activeSidebar && contextualItems ? { state: activeSidebar, items: contextualItems } : undefined

  const handleItemClick = (item: PropSidebarItem) => {
    // Mobile sidebar should only be closed if the category has a link
    if (item.type === 'category' && item.href) {
      mobileSidebar.toggle()
    }
    if (item.type === 'link') {
      mobileSidebar.toggle()
    }
  }

  const handleBack = () => {
    clearSidebar()
    requestAnimationFrame(() => navigationRef.current?.focus())
  }

  return (
    <div
      ref={navigationRef}
      tabIndex={-1}
      data-sidebar-pane={contextualSidebar ? 'contextual' : 'root'}
      aria-label="Docs sidebar"
      role="navigation"
    >
      {contextualSidebar ? (
        <ContextualContent
          activePath={path}
          items={contextualSidebar.items}
          label={contextualSidebar.state.categoryLabel}
          onBack={handleBack}
          onItemClick={handleItemClick}
        />
      ) : (
        <ul className={clsx(ThemeClassNames.docs.docSidebarMenu, 'menu__list')}>
          <DocSidebarItems items={sidebar} activePath={path} onItemClick={handleItemClick} level={1} />
        </ul>
      )}
    </div>
  )
}

function DocSidebarMobile(props: Props) {
  return <NavbarSecondaryMenuFiller component={DocSidebarMobileSecondaryMenu} props={props} />
}

export default React.memo(DocSidebarMobile)
