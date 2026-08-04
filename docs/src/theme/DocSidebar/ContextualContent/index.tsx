import React, { type ReactNode } from 'react'
import { ThemeClassNames } from '@docusaurus/theme-common'
import DocSidebarItems from '@theme/DocSidebarItems'
import type { PropSidebarItem } from '@docusaurus/plugin-content-docs'

import styles from './styles.module.css'

type Props = Readonly<{
  activePath: string
  items: readonly PropSidebarItem[]
  label: string
  onBack: () => void
  onItemClick?: (item: PropSidebarItem) => void
}>

export default function ContextualContent({ activePath, items, label, onBack, onItemClick }: Props): ReactNode {
  return (
    <>
      <div className={styles.header}>
        <button className={styles.backButton} type="button" onClick={onBack}>
          <span aria-hidden="true">←</span>
          Back to docs
        </button>
        <h2 className={styles.heading}>{label}</h2>
      </div>
      <ul className={`${ThemeClassNames.docs.docSidebarMenu} menu__list`}>
        <DocSidebarItems items={items} activePath={activePath} level={1} onItemClick={onItemClick} />
      </ul>
    </>
  )
}
