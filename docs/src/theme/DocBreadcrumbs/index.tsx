import React, { type ReactNode } from 'react'
import clsx from 'clsx'
import { ThemeClassNames } from '@docusaurus/theme-common'
import { useDoc, useSidebarBreadcrumbs } from '@docusaurus/plugin-content-docs/client'
import { useHomePageRoute } from '@docusaurus/theme-common/internal'
import { translate } from '@docusaurus/Translate'
import HomeBreadcrumbItem from '@theme/DocBreadcrumbs/Items/Home'
import DocBreadcrumbsStructuredData from '@theme/DocBreadcrumbs/StructuredData'
import { BreadcrumbsItemLink, BreadcrumbsItem } from '@site/src/components/ui/breadcrumbs'
import BrowserOnly from '@docusaurus/BrowserOnly'
import { CopyOpenInButton } from '@site/src/components/copy-page-button'
import { useContextualSidebar } from '../contextual-sidebar-context'
import styles from './styles.module.css'

export default function DocBreadcrumbs(): ReactNode {
  const breadcrumbs = useSidebarBreadcrumbs()
  const homePageRoute = useHomePageRoute()
  const { clearSidebar } = useContextualSidebar()
  const { metadata } = useDoc()

  if (!breadcrumbs || metadata.id === 'index' || metadata.id === 'develop') {
    return null
  }

  return (
    <div data-name="doc-breadcrumbs-copy" className="mb-8 flex flex-wrap items-center justify-between gap-2">
      <DocBreadcrumbsStructuredData breadcrumbs={breadcrumbs} />
      <nav
        className={clsx(ThemeClassNames.docs.docBreadcrumbs, styles.breadcrumbsContainer)}
        aria-label={translate({
          id: 'theme.docs.breadcrumbs.navAriaLabel',
          message: 'Breadcrumbs',
          description: 'The ARIA label for the breadcrumbs',
        })}
      >
        <ul className="breadcrumbs">
          {homePageRoute && <HomeBreadcrumbItem />}
          {breadcrumbs.map((item, idx) => {
            const isLast = idx === breadcrumbs.length - 1
            const href = item.type === 'category' && item.linkUnlisted ? undefined : item.href
            return (
              <BreadcrumbsItem key={idx} active={isLast}>
                <BreadcrumbsItemLink
                  href={href}
                  isLast={isLast}
                  onClick={idx === 0 ? clearSidebar : undefined}
                  className={idx === 0 && !href ? styles.contextualBack : undefined}
                >
                  {item.label}
                </BreadcrumbsItemLink>
              </BreadcrumbsItem>
            )
          })}
        </ul>
      </nav>
      <BrowserOnly fallback={<div />}>{() => <CopyOpenInButton />}</BrowserOnly>
    </div>
  )
}
