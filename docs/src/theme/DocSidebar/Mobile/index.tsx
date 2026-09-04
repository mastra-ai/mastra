import React from 'react'
import clsx from 'clsx'
import { NavbarSecondaryMenuFiller, type NavbarSecondaryMenuComponent, ThemeClassNames } from '@docusaurus/theme-common'
import { useNavbarMobileSidebar } from '@docusaurus/theme-common/internal'
import DocSidebarItems from '@theme/DocSidebarItems'
import type { Props } from '@theme/DocSidebar/Mobile'
import type { PropSidebarItem } from '@docusaurus/plugin-content-docs'
import { ContextualSidebarEnabledProvider } from '../../contextual-sidebar-context'

// eslint-disable-next-line react/function-component-definition
const DocSidebarMobileSecondaryMenu: NavbarSecondaryMenuComponent<Props> = ({ sidebar, path }) => {
  const mobileSidebar = useNavbarMobileSidebar()

  const handleItemClick = (item: PropSidebarItem) => {
    // Mobile sidebar should only be closed if the category has a link
    if (item.type === 'category' && item.href) {
      mobileSidebar.toggle()
    }
    if (item.type === 'link') {
      mobileSidebar.toggle()
    }
  }

  return (
    <div data-sidebar-pane="root" aria-label="Docs sidebar" role="navigation">
      <ContextualSidebarEnabledProvider enabled={false}>
        <ul className={clsx(ThemeClassNames.docs.docSidebarMenu, 'menu__list')}>
          <DocSidebarItems items={sidebar} activePath={path} onItemClick={handleItemClick} level={1} />
        </ul>
      </ContextualSidebarEnabledProvider>
    </div>
  )
}

function DocSidebarMobile(props: Props) {
  return <NavbarSecondaryMenuFiller component={DocSidebarMobileSecondaryMenu} props={props} />
}

export default React.memo(DocSidebarMobile)
