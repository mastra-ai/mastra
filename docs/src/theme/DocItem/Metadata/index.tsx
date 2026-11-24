import React, { type ReactNode } from 'react'
import { PageMetadata } from '@docusaurus/theme-common'
import { useDoc } from '@docusaurus/plugin-content-docs/client'

const OG_IMAGE_BASE_URL = 'https://mastra.ai/api/og/page'

export default function DocItemMetadata(): ReactNode {
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
