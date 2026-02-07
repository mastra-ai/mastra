import React, { type ReactNode } from 'react'
import clsx from 'clsx'
import { ThemeClassNames } from '@docusaurus/theme-common'
import { useSidebarBreadcrumbs } from '@docusaurus/plugin-content-docs/client'
import { useHomePageRoute } from '@docusaurus/theme-common/internal'
import { translate } from '@docusaurus/Translate'
import { useLocation } from '@docusaurus/router'
import HomeBreadcrumbItem from '@theme/DocBreadcrumbs/Items/Home'
import DocBreadcrumbsStructuredData from '@theme/DocBreadcrumbs/StructuredData'
import { BreadcrumbsItemLink, BreadcrumbsItem } from '@site/src/components/ui/breadcrumbs'
import BrowserOnly from '@docusaurus/BrowserOnly'
import { CopyOpenInButton } from '@site/src/components/copy-page-button'
import styles from './styles.module.css'

export default function DocBreadcrumbs(): ReactNode {
  const breadcrumbs = useSidebarBreadcrumbs()
  const homePageRoute = useHomePageRoute()
  const location = useLocation()

  if (!breadcrumbs) {
    return null
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
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

            // Get href for the breadcrumb item
            let href = item.href

            // For categories without direct href, try to find an appropriate link
            if (item.type === 'category' && !href && item.items) {
              // First priority: Look for an "Overview" or "Default" page
              const overviewLink = item.items.find(
                (child: any) =>
                  child.type === 'link' &&
                  !child.unlisted &&
                  (child.label === 'Overview' || child.label === 'Default' || child.key?.endsWith('.overview')),
              )

              // Second priority: Use the first non-unlisted link that's NOT the current page
              const firstLink = item.items.find(
                (child: any) => child.type === 'link' && !child.unlisted && child.href !== location.pathname,
              )

              href = overviewLink?.href || firstLink?.href
            }

            // Don't make clickable if it's the last item or would navigate to current page
            const shouldBeClickable = !isLast && href && href !== location.pathname

            return (
              <BreadcrumbsItem key={idx} active={isLast}>
                <BreadcrumbsItemLink href={shouldBeClickable ? href : undefined} isLast={isLast}>
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
