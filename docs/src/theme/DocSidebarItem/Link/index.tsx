import React, { type ReactNode } from 'react'
import clsx from 'clsx'
import { ThemeClassNames } from '@docusaurus/theme-common'
import { isActiveSidebarItem } from '@docusaurus/plugin-content-docs/client'
import Link from '@docusaurus/Link'
import isInternalUrl from '@docusaurus/isInternalUrl'
import IconExternalLink from '@theme/Icon/ExternalLink'
import type { Props } from '@theme/DocSidebarItem/Link'
import SidebarBadge from '@site/src/components/SidebarBadge'

import { isPlainPrimaryClick } from '../../contextual-sidebar'
import { useIsContextualSidebarPane } from '../../contextual-sidebar-context'
import styles from './styles.module.css'
import { getBadgeType } from '../utils'
import { normalizeSiteSectionRoot } from '@site/src/utils/canonical-url'

function LinkLabel({ label, item }: { label: string; item: any }) {
  // Get tags from customProps in sidebar config
  const tags = item?.customProps?.tags

  const badgeType = getBadgeType(tags)

  return (
    <>
      <span title={label} className={styles.linkLabel}>
        {label}
      </span>
      {badgeType && <SidebarBadge type={badgeType} />}
    </>
  )
}

export default function DocSidebarItemLink({
  item,
  onItemClick,
  activePath,
  level,
  index,
  ...props
}: Props): ReactNode {
  const { href, label, className, autoAddBaseUrl } = item
  const isInternalLink = isInternalUrl(href)
  const linkHref = isInternalLink ? normalizeSiteSectionRoot(href) : href
  const isActive = isActiveSidebarItem(item, activePath)
  const isContextualSidebarPane = useIsContextualSidebarPane()

  return (
    <li
      className={clsx(
        ThemeClassNames.docs.docSidebarItemLink,
        ThemeClassNames.docs.docSidebarItemLinkLevel(level),
        'menu__list-item',
        className,
      )}
      key={label}
    >
      <Link
        className={clsx('menu__link', !isInternalLink && styles.menuExternalLink, {
          'menu__link--active': isActive,
        })}
        autoAddBaseUrl={autoAddBaseUrl}
        aria-current={isActive ? 'page' : undefined}
        to={linkHref}
        {...(isInternalLink && {
          onClick: onItemClick
            ? event => {
                if (!isContextualSidebarPane || isPlainPrimaryClick(event)) {
                  onItemClick(item)
                }
              }
            : undefined,
        })}
        {...props}
      >
        <LinkLabel label={label} item={item} />
        {!isInternalLink && <IconExternalLink />}
      </Link>
    </li>
  )
}
