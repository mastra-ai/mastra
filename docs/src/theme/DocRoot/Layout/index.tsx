import { useDocsSidebar } from '@docusaurus/plugin-content-docs/client'
import BackToTopButton from '@theme/BackToTopButton'
import type { Props } from '@theme/DocRoot/Layout'
import DocRootLayoutMain from '@theme/DocRoot/Layout/Main'
import DocRootLayoutSidebar from '@theme/DocRoot/Layout/Sidebar'
import { type ReactNode, useState } from 'react'

import styles from './styles.module.css'

export default function DocRootLayout({ children }: Props): ReactNode {
  const sidebar = useDocsSidebar()
  const [hiddenSidebarContainer, setHiddenSidebarContainer] = useState(false)

  return (
    <div className={styles.docsWrapper}>
      <BackToTopButton />
      <div className={styles.docRoot}>
        {sidebar && (
          <DocRootLayoutSidebar
            sidebar={sidebar.items}
            hiddenSidebarContainer={hiddenSidebarContainer}
            setHiddenSidebarContainer={setHiddenSidebarContainer}
          />
        )}
        <DocRootLayoutMain hiddenSidebarContainer={hiddenSidebarContainer}>{children}</DocRootLayoutMain>
      </div>
    </div>
  )
}
