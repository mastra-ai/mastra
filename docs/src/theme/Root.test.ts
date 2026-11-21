// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { PostHogInterface } from 'posthog-js'
import { usePostHog } from 'posthog-js/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@docusaurus/useGlobalData', () => ({ usePluginData: () => undefined }))
vi.mock('@docusaurus/useDocusaurusContext', () => ({
  default: () => ({ siteConfig: { customFields: { posthogApiKey: 'phc_docs_test' } } }),
}))
vi.mock('@site/src/components/cookie/cookie-consent', () => ({ CookieConsent: () => null }))
vi.mock('@site/src/theme/webmcp', () => ({ mountWebMcp: () => () => undefined }))
vi.mock('@mastra/docusaurus-plugin-kapa/client', () => ({
  DocsChatProvider: ({ children }: { children: React.ReactNode }) => children,
  KapaChatProvider: ({ children }: { children: React.ReactNode }) => children,
}))

import Root from './Root'

let providerClient: PostHogInterface | undefined

function ReadProviderClient() {
  providerClient = usePostHog()
  return null
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete window.mastraDocsPosthog
  providerClient = undefined
})

describe('docs PostHog handoff', () => {
  it('gives GTM the initialized provider client and its visitor and session IDs', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(React.createElement(Root, null, React.createElement(ReadProviderClient)))
      })

      await vi.waitFor(() => {
        expect(window.mastraDocsPosthog).toBeDefined()
        expect(window.mastraDocsPosthog).toBe(providerClient)
        expect(window.mastraDocsPosthog?.get_distinct_id()).toBeTruthy()
        expect(window.mastraDocsPosthog?.get_session_id()).toBeTruthy()
      })
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })

  it('renders without accessing a browser global on the server', () => {
    vi.stubGlobal('window', undefined)
    expect(() => renderToString(React.createElement(Root, null, 'Docs'))).not.toThrow()
  })
})
