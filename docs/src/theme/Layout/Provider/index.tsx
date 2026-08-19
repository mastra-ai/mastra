import React, { type ReactNode } from 'react'
import { composeProviders } from '@docusaurus/theme-common'
import {
  ColorModeProvider,
  AnnouncementBarProvider,
  ScrollControllerProvider,
  NavbarProvider,
  PluginHtmlClassNameProvider,
} from '@docusaurus/theme-common/internal'
import { DocsPreferredVersionContextProvider } from '@docusaurus/plugin-content-docs/client'
import type { Props } from '@theme/Layout/Provider'
import { ContextualSidebarProvider } from '../../contextual-sidebar-context'

const Provider = composeProviders([
  ColorModeProvider,
  AnnouncementBarProvider,
  ScrollControllerProvider,
  DocsPreferredVersionContextProvider,
  PluginHtmlClassNameProvider,
  NavbarProvider,
])

export default function LayoutProvider({ children }: Props): ReactNode {
  return (
    <Provider>
      <ContextualSidebarProvider>{children}</ContextualSidebarProvider>
    </Provider>
  )
}
