import React, { type ReactNode } from 'react'
import { HtmlClassNameProvider } from '@docusaurus/theme-common'
import { DocProvider } from '@docusaurus/plugin-content-docs/client'
import ApiItem from '@theme/ApiItem'
import DocItemLayout from '@theme/DocItem/Layout'
import DocItemMetadata from '@theme/DocItem/Metadata'
import type { Props } from '@theme/DocItem'

export default function DocItem(props: Props): ReactNode {
  // Pages generated from an OpenAPI document (see scripts/gateway-api) render with the API Explorer.
  if ('api' in props.content.frontMatter) return <ApiItem {...props} />

  const docHtmlClassName = `docs-doc-id-${props.content.metadata.id}`
  const MDXComponent = props.content
  return (
    <DocProvider content={props.content}>
      <HtmlClassNameProvider className={docHtmlClassName}>
        <DocItemMetadata />
        <DocItemLayout>
          <MDXComponent />
        </DocItemLayout>
      </HtmlClassNameProvider>
    </DocProvider>
  )
}
