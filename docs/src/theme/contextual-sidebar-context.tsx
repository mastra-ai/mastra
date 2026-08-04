import React, { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { useLocation } from '@docusaurus/router'
import type { PropSidebarItem, PropSidebarItemCategory } from '@docusaurus/plugin-content-docs'
import {
  enterContextualSidebar,
  getContextualSidebarItems,
  isContextualSidebarVisible,
  observeContextualSidebarPathname,
  type ContextualSidebarState,
} from './contextual-sidebar'

type ContextualSidebarContextValue = Readonly<{
  activeSidebar: ContextualSidebarState | undefined
  clearSidebar: () => void
  enterSidebar: (category: PropSidebarItemCategory) => void
  getSidebarItems: (sidebar: readonly PropSidebarItem[]) => readonly PropSidebarItem[] | undefined
}>

const ContextualSidebarContext = createContext<ContextualSidebarContextValue | undefined>(undefined)

export function ContextualSidebarProvider({ children }: { children: ReactNode }): ReactNode {
  const { pathname } = useLocation()
  const {
    siteConfig: { url: siteUrl },
  } = useDocusaurusContext()
  const [sidebarState, setSidebarState] = useState<ContextualSidebarState>()
  const observedState = observeContextualSidebarPathname(sidebarState, pathname)

  useEffect(() => {
    if (observedState !== sidebarState) {
      setSidebarState(observedState)
    }
  }, [observedState, sidebarState])

  const activeSidebar = isContextualSidebarVisible(sidebarState, pathname) ? sidebarState : undefined

  const value: ContextualSidebarContextValue = {
    activeSidebar,
    clearSidebar: () => setSidebarState(undefined),
    enterSidebar: category => {
      const nextState = enterContextualSidebar(category, pathname, siteUrl)
      if (nextState) {
        setSidebarState(nextState)
      }
    },
    getSidebarItems: sidebar => getContextualSidebarItems(sidebar, activeSidebar),
  }

  return <ContextualSidebarContext.Provider value={value}>{children}</ContextualSidebarContext.Provider>
}

export function useContextualSidebar(): ContextualSidebarContextValue {
  const value = useContext(ContextualSidebarContext)
  if (!value) {
    throw new Error('useContextualSidebar must be used within ContextualSidebarProvider')
  }
  return value
}
