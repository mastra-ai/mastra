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
  rootScrollState: React.RefObject<{ restorePending: boolean; scrollTop: number }>
}>

const ContextualSidebarContext = createContext<ContextualSidebarContextValue | undefined>(undefined)
const ContextualSidebarPaneContext = createContext(false)
const ContextualSidebarEnabledContext = createContext(true)

export function ContextualSidebarPaneProvider({ children }: { children: ReactNode }): ReactNode {
  return <ContextualSidebarPaneContext.Provider value>{children}</ContextualSidebarPaneContext.Provider>
}

export function ContextualSidebarEnabledProvider({
  children,
  enabled,
}: {
  children: ReactNode
  enabled: boolean
}): ReactNode {
  return <ContextualSidebarEnabledContext.Provider value={enabled}>{children}</ContextualSidebarEnabledContext.Provider>
}

export function useIsContextualSidebarPane(): boolean {
  return useContext(ContextualSidebarPaneContext)
}

export function useIsContextualSidebarEnabled(): boolean {
  return useContext(ContextualSidebarEnabledContext)
}

export function ContextualSidebarProvider({ children }: { children: ReactNode }): ReactNode {
  const { pathname } = useLocation()
  const {
    siteConfig: { url: siteUrl },
  } = useDocusaurusContext()
  const [suppressedPathnames, setSuppressedPathnames] = useState(() => new Set<string>())
  const [sidebarState, setSidebarState] = useState<ContextualSidebarState>()
  const rootScrollState = useRef({ restorePending: false, scrollTop: 0 })
  const observedState = observeContextualSidebarPathname(sidebarState, pathname)

  useEffect(() => {
    if (observedState !== sidebarState) {
      if (!observedState && sidebarState && pathname === sidebarState.entryPathname) {
        setSuppressedPathnames(currentPathnames => {
          const nextPathnames = new Set(currentPathnames)
          for (const destinationPathname of sidebarState.destinationPathnames) {
            nextPathnames.add(destinationPathname)
          }
          return nextPathnames
        })
      }
      setSidebarState(observedState)
    }
  }, [observedState, pathname, sidebarState])

  const activeSidebar = isContextualSidebarVisible(observedState, pathname) ? observedState : undefined

  const value: ContextualSidebarContextValue = {
    activateSidebar: state => {
      setSuppressedPathnames(currentPathnames => {
        if (!currentPathnames.has(pathname)) return currentPathnames
        const nextPathnames = new Set(currentPathnames)
        nextPathnames.delete(pathname)
        return nextPathnames
      })
      setSidebarState(state)
    },
    clearSidebar: () => {
      setSuppressedPathnames(currentPathnames => new Set(currentPathnames).add(pathname))
      setSidebarState(undefined)
    },
    enterSidebar: category => {
      const nextState = enterContextualSidebar(category, pathname, siteUrl)
      if (nextState) {
        setSuppressedPathnames(currentPathnames => {
          if (!currentPathnames.has(pathname)) return currentPathnames
          const nextPathnames = new Set(currentPathnames)
          nextPathnames.delete(pathname)
          return nextPathnames
        })
        setSidebarState(nextState)
      }
    },
    resolveSidebar: sidebar => {
      let state = activeSidebar
      if (!state && !suppressedPathnames.has(pathname)) {
        const category = findInitialContextualSidebarCategory(sidebar, pathname, siteUrl)
        if (category) {
          state = enterContextualSidebar(category, pathname, siteUrl)
        }
      }

      const items = getContextualSidebarItems(sidebar, state)
      return state && items ? { state, items } : undefined
    },
    rootScrollState,
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
