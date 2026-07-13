import type { KapaPluginOptions } from '@mastra/docusaurus-plugin-kapa'
import type { Props } from '@theme/DocRoot/Layout/Main'
import type { ReactNode, RefObject } from 'react'
import { usePluginData } from '@docusaurus/useGlobalData'
import { useDocsChat } from '@mastra/docusaurus-plugin-kapa/client'
import Chat from '@theme/Chat'
import { FooterContent } from '@theme/Footer'
import clsx from 'clsx'
import { MessageCircle } from 'lucide-react'
import * as React from 'react'

/**
 * Local override of `@mastra/docusaurus-plugin-kapa`'s `DocRoot/Layout/Main`.
 *
 * The published plugin mounts its `KapaProvider` (which owns the Kapa chat
 * conversation) inside this per-doc-page layout. Navigating via the navbar can
 * swap the doc layout, unmounting the provider and resetting the conversation,
 * while sidebar navigation stays within the layout and preserves it.
 *
 * To keep the conversation alive across all navigation, the provider is hoisted
 * to `src/theme/Root.tsx` (app-level, never unmounts). This copy is identical to
 * the plugin's Main except the `KapaProvider` wrapper is removed. The two small
 * hooks the plugin keeps internal (`use-focus-trap`, `use-is-mobile`) are
 * inlined here since they are not exported.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
}

function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  triggerRef: RefObject<HTMLElement | null>,
): void {
  React.useEffect(() => {
    if (!active || !containerRef.current) return

    const container = containerRef.current
    const savedTrigger = triggerRef.current
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea:not([disabled])')
    if (textarea) textarea.focus()
    else getFocusableElements(container)[0]?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = getFocusableElements(container)
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      savedTrigger?.focus()
    }
  }, [active, containerRef, triggerRef])
}

const MOBILE_BREAKPOINT = '(max-width: 74.9375rem)'

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_BREAKPOINT).matches : false,
  )
  React.useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return isMobile
}

export default function DocRootLayoutMain({ hiddenSidebarContainer, children }: Props): ReactNode {
  const pluginData = usePluginData('docusaurus-plugin-kapa', 'default', { failfast: false }) as
    | KapaPluginOptions
    | undefined
  const kapaEnabled = Boolean(pluginData?.integrationId)
  const { isHidden, toggle, close, triggerRef } = useDocsChat()
  const isMobile = useIsMobile()
  const asideRef = React.useRef<HTMLElement>(null)
  const isModalOpen = kapaEnabled && isMobile && !isHidden

  useFocusTrap(asideRef, isModalOpen, triggerRef)

  React.useEffect(() => {
    if (!isModalOpen) return

    const htmlOverflow = document.documentElement.style.overflow
    const bodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    return () => {
      document.documentElement.style.overflow = htmlOverflow
      document.body.style.overflow = bodyOverflow
    }
  }, [isModalOpen])

  if (!kapaEnabled) {
    return (
      <main className={clsx('doc-main-container', hiddenSidebarContainer && 'doc-main-container--enhanced')}>
        <div className="doc-chat-layout">
          <div
            className={clsx(
              'padding-top--md padding-bottom--lg container',
              'doc-item-wrapper',
              hiddenSidebarContainer && 'doc-item-wrapper--enhanced',
            )}
          >
            {children}
          </div>
        </div>
        <FooterContent inColumn />
      </main>
    )
  }

  return (
    <main className={clsx('doc-main-container', hiddenSidebarContainer && 'doc-main-container--enhanced')}>
      <div className="doc-chat-layout">
        <div
          className={clsx(
            'padding-top--md padding-bottom--lg container',
            'doc-item-wrapper',
            hiddenSidebarContainer && 'doc-item-wrapper--enhanced',
          )}
          inert={isModalOpen || undefined}
        >
          {children}
        </div>
        <aside
          ref={asideRef}
          id="docs-chat-panel"
          aria-hidden={isHidden}
          aria-label="AI chat"
          inert={isHidden || undefined}
          role={isModalOpen ? 'dialog' : undefined}
          aria-modal={isModalOpen ? true : undefined}
          onKeyDown={e => {
            if (e.key === 'Escape') close()
          }}
          className={clsx(
            'doc-chat-sidebar',
            isModalOpen && 'doc-chat-sidebar--open',
            isHidden && 'doc-chat-sidebar--hidden',
          )}
        >
          <div className="doc-chat-sidebar__inner">
            <Chat />
          </div>
        </aside>
        <button
          type="button"
          className="clean-btn doc-chat-fab"
          onClick={toggle}
          aria-label={isHidden ? 'Open AI chat' : 'Close AI chat'}
          aria-expanded={!isHidden}
          aria-controls="docs-chat-panel"
        >
          <MessageCircle />
        </button>
      </div>
      <FooterContent inColumn />
    </main>
  )
}
