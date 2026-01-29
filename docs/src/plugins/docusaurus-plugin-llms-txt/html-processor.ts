/**
 * HTML to Markdown conversion pipeline
 */

import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkStringify from 'remark-stringify'
import remarkGfm from 'remark-gfm'
import type { Root as HastRoot, Element } from 'hast'
import type { Root as MdastRoot } from 'mdast'

import { handleCodeBlock } from './code-block-handler'
import { createLinkHandler } from './link-handler'
import { extractMetadata, selectContent, removeUnwantedElements, type PageMetadata } from './content-extractor'
import type { ResolvedOptions } from './options'

export interface ProcessedPage {
  metadata: PageMetadata
  markdown: string
  llmsTxt: string
}

/**
 * Process HTML content and convert to markdown
 */
export async function processHtml(html: string, route: string, options: ResolvedOptions): Promise<ProcessedPage> {
  // Parse HTML to HAST
  const hast = unified().use(rehypeParse, { fragment: false }).parse(html) as HastRoot

  // Extract metadata
  const metadata = extractMetadata(hast)

  // Select content element
  const content = selectContent(hast, options.contentSelectors)

  if (!content) {
    return {
      metadata,
      markdown: '',
      llmsTxt: '',
    }
  }

  // Clone the content to avoid mutating the original
  const contentClone = JSON.parse(JSON.stringify(content)) as Element

  // Remove unwanted elements
  removeUnwantedElements(contentClone)

  // Create the link handler with options
  const linkHandler = createLinkHandler({ siteUrl: options.siteUrl, excludeRoutes: options.excludeRoutes })

  // Convert to Markdown
  const processor = unified()
    .use(rehypeRemark, {
      handlers: {
        pre: handleCodeBlock,
        a: linkHandler,
      },
    })
    .use(remarkGfm)
    .use(remarkStringify, {
      bullet: '-',
      emphasis: '_',
      fence: '`',
      fences: true,
      listItemIndent: 'one',
    })

  // Process the content
  // We need to wrap the element in a root node for processing
  const hastRoot: HastRoot = {
    type: 'root',
    children: [contentClone],
  }

  const mdast = (await processor.run(hastRoot)) as MdastRoot
  let markdown = processor.stringify(mdast)

  // Post-process to clean up artifacts
  markdown = cleanupMarkdown(markdown)

  // Format as llms.txt
  const llmsTxt = markdown.trim()

  return {
    metadata,
    markdown,
    llmsTxt,
  }
}

/**
 * Clean up markdown artifacts from conversion
 */
function cleanupMarkdown(markdown: string): string {
  return (
    markdown
      // Remove lines that start with "\=" (escaped default value indicators from reference docs)
      // e.g., "\= {}" or "\= Console logger with INFO level"
      .replace(/^\s*\\=.*$/gm, '')
      // Remove lines that are just "{}" (empty default objects)
      .replace(/^\s*\{\}\s*$/gm, '')
      // Remove any HTML comments that made it through
      .replace(/<!--\s*-->/g, '')
      // Remove escaped angle brackets around type annotations that are alone on a line
      // e.g., \<string, Agent> alone on a line
      .replace(/^\s*\\<[^>]+>\s*$/gm, match => match.trim())
      // Collapse multiple consecutive blank lines into one blank line
      .replace(/\n{3,}/g, '\n\n')
      // Remove trailing whitespace from lines
      .replace(/[ \t]+$/gm, '')
  )
}
