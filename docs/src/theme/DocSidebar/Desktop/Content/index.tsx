import React, { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { prefersReducedMotion, ThemeClassNames } from '@docusaurus/theme-common'
import { useAnnouncementBar, useScrollPosition } from '@docusaurus/theme-common/internal'
import { translate } from '@docusaurus/Translate'
import DocSidebarItems from '@theme/DocSidebarItems'
import type { PropSidebarItem } from '@docusaurus/plugin-content-docs'
import type { Props } from '@theme/DocSidebar/Desktop/Content'
import VersionControl from '@site/src/components/version-control'
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
  const versionControlRef = useRef<HTMLDivElement>(null)
  const { activateSidebar, clearSidebar, resolveSidebar, rootScrollState } = useContextualSidebar()
  const contextualSidebar = resolveSidebar(sidebar)
  const [exitingContextualSidebar, setExitingContextualSidebar] = useState<typeof contextualSidebar>()
  const renderedContextualSidebar = contextualSidebar ?? exitingContextualSidebar
  const isContextualSidebarExiting = !contextualSidebar && Boolean(exitingContextualSidebar)
  const paneKey = contextualSidebar?.state.categoryHref ?? 'root'
  const previousPaneKey = useRef(paneKey)
  const shouldAnimateContextualEntry = previousPaneKey.current === 'root' && paneKey !== 'root'

  useLayoutEffect(() => {
    const navigation = navigationRef.current
    const previousPane = previousPaneKey.current
    if (!navigation || previousPane === paneKey) return

    if (paneKey === 'root') {
      if (rootScrollState.current.restorePending) {
        navigation.scrollTop = rootScrollState.current.scrollTop
        rootScrollState.current.restorePending = false
      }
    } else {
      navigation.scrollTop = 0
    }
    previousPaneKey.current = paneKey
  }, [paneKey, rootScrollState])

  useLayoutEffect(() => {
    const navigation = navigationRef.current
    if (!navigation) return

    const updateScrollbarGutter = () => {
      const gutterWidth = navigation.offsetWidth - navigation.clientWidth
      navigation.style.setProperty('--sidebar-scrollbar-gutter', `${gutterWidth}px`)
    }

    updateScrollbarGutter()
    const resizeObserver = new ResizeObserver(updateScrollbarGutter)
    resizeObserver.observe(navigation)

    return () => resizeObserver.disconnect()
  }, [])

  useEffect(() => {
    const navigation = navigationRef.current
    const versionControl = versionControlRef.current
    if (!navigation || !versionControl) return

    const updateBottomFade = () => {
      const hasMoreContent = navigation.scrollTop + navigation.clientHeight < navigation.scrollHeight - 1
      versionControl.dataset.fadeVisible = String(hasMoreContent)
    }

    updateBottomFade()
    navigation.addEventListener('scroll', updateBottomFade, { passive: true })

    const resizeObserver = new ResizeObserver(updateBottomFade)
    resizeObserver.observe(navigation)
    for (const child of navigation.children) {
      resizeObserver.observe(child)
    }

    return () => {
      navigation.removeEventListener('scroll', updateBottomFade)
      resizeObserver.disconnect()
    }
  }, [renderedContextualSidebar, sidebar])

  const finishContextualExit = () => {
    setExitingContextualSidebar(undefined)
    requestAnimationFrame(() => navigationRef.current?.focus())
  }

  const handleRootItemClick = (item: PropSidebarItem) => {
    if (item.type === 'category' && item.customProps?.contextualSidebar === true && navigationRef.current) {
      rootScrollState.current = {
        restorePending: true,
        scrollTop: navigationRef.current.scrollTop,
      }
    }
  }

  const handleBack = () => {
    if (!contextualSidebar || prefersReducedMotion()) {
      clearSidebar()
      requestAnimationFrame(() => navigationRef.current?.focus())
      return
    }

    setExitingContextualSidebar(contextualSidebar)
    clearSidebar()
  }

  const handleContextualExitAnimationEnd: React.AnimationEventHandler<HTMLDivElement> = event => {
    if (exitingContextualSidebar && event.target === event.currentTarget) {
      finishContextualExit()
    }
  }

  return (
    <div className={styles.scrollContainer}>
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
        <ul
          data-sidebar-panel="root"
          className={clsx(
            ThemeClassNames.docs.docSidebarMenu,
            'menu__list',
            styles.pane,
            contextualSidebar && styles['root-pane-inactive'],
          )}
          aria-hidden={contextualSidebar ? true : undefined}
          inert={contextualSidebar ? true : undefined}
        >
          <DocSidebarItems items={sidebar} activePath={path} level={1} onItemClick={handleRootItemClick} />
        </ul>
        {renderedContextualSidebar && (
          <ContextualContent
            key={paneKey}
            activePath={path}
            items={renderedContextualSidebar.items}
            label={renderedContextualSidebar.state.categoryLabel}
            onBack={handleBack}
            onItemClick={() => activateSidebar(renderedContextualSidebar.state)}
            paneClassName={styles.pane}
            entryAnimationClassName={styles['contextual-pane-enter']}
            exitAnimationClassName={styles['contextual-pane-exit']}
            animateEntry={shouldAnimateContextualEntry}
            isExiting={isContextualSidebarExiting}
            onExitAnimationEnd={handleContextualExitAnimationEnd}
          />
        )}
        <div ref={versionControlRef} className={styles.versionControl}>
          <VersionControl />
        </div>
      </nav>
    </div>
  )
}
