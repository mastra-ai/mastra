import React, { type ReactNode } from 'react'
import OriginalFooter from '@theme-original/Footer'

export { default } from '@theme-original/Footer'

/**
 * `@mastra/docusaurus-plugin-kapa`'s `DocRoot/Layout/Main` override imports a
 * named `FooterContent` from `@theme/Footer` and renders it inside the doc
 * content column. Docusaurus' classic theme only exports a default `Footer`,
 * so this named export is required for the plugin to build regardless of the
 * Docusaurus version. The `inColumn` prop the plugin passes is accepted but
 * unused here — we simply render the standard site footer.
 */
export function FooterContent(_props: { inColumn?: boolean } = {}): ReactNode {
  return <OriginalFooter />
}
