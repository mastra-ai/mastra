import React, { type ReactNode } from 'react'
import OriginalFooter from '@theme-original/Footer'

export { default } from '@theme-original/Footer'

/**
 * `@mastra/docusaurus-plugin-kapa`'s `DocRoot/Layout/Main` override imports a
 * named `FooterContent` from `@theme/Footer`, which Docusaurus 3.9's classic
 * theme does not provide. Expose it here so the plugin's Main can render the
 * site footer inside the doc content column.
 */
export function FooterContent(_props: { inColumn?: boolean } = {}): ReactNode {
  return <OriginalFooter />
}
