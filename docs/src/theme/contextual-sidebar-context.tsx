import React, { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import { useLocation } from '@docusaurus/router'
import type { PropSidebarItem, PropSidebarItemCategory } from '@docusaurus/plugin-content-docs'
import {
  enterContextualSidebar,
  findInitialContextualSidebarCategory,
  getContextualSidebarItems,
  isContextualSidebarVisible,
  observeContextualSidebarPathname,
  type ContextualSidebarState,
} from './contextual-sidebar'

type ResolvedContextualSidebar = Readonly<{
  items: readonly PropSidebarItem[]
  state: ContextualSidebarState
}>

type ContextualSidebarContextValue = Readonly<{
  activateSidebar: (state: ContextualSidebarState) => void
  clearSidebar: () => void
  enterSidebar: (category: PropSidebarItemCategory) => void
  resolveSidebar: (sidebar: readonly PropSidebarItem[]) => ResolvedContextualSidebar | undefined
}>

const ContextualSidebarContext = createContext<ContextualSidebarContextValue | undefined>(undefined)
const ContextualSidebarPaneContext = createContext(false)

export function ContextualSidebarPaneProvider({ children }: { children: ReactNode }): ReactNode {
  return <ContextualSidebarPaneContext.Provider value>{children}</ContextualSidebarPaneContext.Provider>
}

export function useIsContextualSidebarPane(): boolean {
  return useContext(ContextualSidebarPaneContext)
}

export function ContextualSidebarProvider({ children }: { children: ReactNode }): ReactNode {
  const { pathname } = useLocation()
  const {
    siteConfig: { url: siteUrl },
  } = useDocusaurusContext()
  const initialPathname = useRef(pathname).current
  const [initialSidebarEnabled, setInitialSidebarEnabled] = useState(true)
  const [sidebarState, setSidebarState] = useState<ContextualSidebarState>()
  const observedState = observeContextualSidebarPathname(sidebarState, pathname)

  useEffect(() => {
    if (observedState !== sidebarState) {
      setSidebarState(observedState)
    }
  }, [observedState, sidebarState])

  const activeSidebar = isContextualSidebarVisible(sidebarState, pathname) ? sidebarState : undefined

  const value: ContextualSidebarContextValue = {
    activateSidebar: state => {
      setInitialSidebarEnabled(false)
      setSidebarState(state)
    },
    clearSidebar: () => {
      setInitialSidebarEnabled(false)
      setSidebarState(undefined)
    },
    enterSidebar: category => {
      const nextState = enterContextualSidebar(category, pathname, siteUrl)
      if (nextState) {
        setInitialSidebarEnabled(false)
        setSidebarState(nextState)
      }
    },
    resolveSidebar: sidebar => {
      let state = activeSidebar
      if (!state && initialSidebarEnabled && pathname === initialPathname) {
        const category = findInitialContextualSidebarCategory(sidebar, pathname, siteUrl)
        if (category) {
          state = enterContextualSidebar(category, pathname, siteUrl)
        }
      }

      const items = getContextualSidebarItems(sidebar, state)
      return state && items ? { state, items } : undefined
    },
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
