import React, { type ReactNode } from 'react'
import { HtmlClassNameProvider } from '@docusaurus/theme-common'
import { DocProvider } from '@docusaurus/plugin-content-docs/client'
import DocItemLayout from '@theme/DocItem/Layout'
import type { Props } from '@theme/DocItem'
import { PageMetadata } from '@docusaurus/theme-common'
import { useDoc } from '@docusaurus/plugin-content-docs/client'

const OG_IMAGE_BASE_URL = 'https://mastra.ai/api/og/page'

function DocItemMetadata(): ReactNode {
  const { metadata, frontMatter } = useDoc()
  const title = metadata.title

  const ogImageUrl = new URL(OG_IMAGE_BASE_URL)
  ogImageUrl.searchParams.set('title', title ?? 'The TypeScript Agent Framework')

  return (
    <PageMetadata
      title={title}
      description={metadata.description}
      keywords={frontMatter.keywords}
      image={frontMatter.image ?? ogImageUrl.toString()}
    />
  )
}

export default function DocItem(props: Props): ReactNode {
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
