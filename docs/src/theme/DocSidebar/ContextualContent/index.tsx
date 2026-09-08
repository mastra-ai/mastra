import React, { type ComponentProps, type ReactNode, useRef } from 'react'
import { ThemeClassNames } from '@docusaurus/theme-common'
import DocSidebarItems from '@theme/DocSidebarItems'
import type { PropSidebarItem } from '@docusaurus/plugin-content-docs'
import { cn } from '../../../lib/utils'
import { ContextualSidebarPaneProvider } from '../../contextual-sidebar-context'

import styles from './styles.module.css'

type Props = Readonly<{
  activePath: string
  items: readonly PropSidebarItem[]
  label: string
  onBack: () => void
  onItemClick?: (item: PropSidebarItem) => void
  paneClassName?: string
  entryAnimationClassName?: string
  exitAnimationClassName?: string
  animateEntry?: boolean
  isExiting?: boolean
  onExitAnimationEnd?: ComponentProps<'div'>['onAnimationEnd']
}>

export default function ContextualContent({
  activePath,
  items,
  label,
  onBack,
  onItemClick,
  paneClassName,
  entryAnimationClassName,
  exitAnimationClassName,
  animateEntry = false,
  isExiting = false,
  onExitAnimationEnd,
}: Props): ReactNode {
  const shouldAnimateEntry = useRef(animateEntry).current
  const contentClassName = cn(
    paneClassName,
    shouldAnimateEntry && entryAnimationClassName,
    isExiting && exitAnimationClassName,
  )

  return (
    <div
      data-sidebar-panel-container="contextual"
      className={contentClassName}
      aria-hidden={isExiting || undefined}
      inert={isExiting || undefined}
      onAnimationEnd={onExitAnimationEnd}
    >
      <div
        className={cn(
          styles.header,
          'rounded-lg border-[0.5px] border-(--border) text-(--mastra-text-secondary) hover:bg-(--mastra-surface-2) dark:bg-(--mastra-surface-4) hover:text-(--mastra-text-primary)',
        )}
      >
        <button className={styles.backButton} type="button" aria-label={`Back to global sidebar`} onClick={onBack}>
          <span className={styles.backArrow} aria-hidden="true"></span>
          <span className={styles.backLabel}>{label}</span>
        </button>
      </div>
      <ContextualSidebarPaneProvider>
        <ul data-sidebar-panel="contextual" className={cn(ThemeClassNames.docs.docSidebarMenu, 'menu__list')}>
          <DocSidebarItems items={items} activePath={activePath} level={1} onItemClick={onItemClick} />
        </ul>
      </ContextualSidebarPaneProvider>
    </div>
  )
}
