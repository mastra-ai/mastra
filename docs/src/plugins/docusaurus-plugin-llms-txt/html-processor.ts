/**
 * HTML to Markdown conversion pipeline
 */

import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkStringify from 'remark-stringify'
import remarkGfm from 'remark-gfm'
import type { Root as HastRoot, Element, Text, Comment, ElementContent } from 'hast'
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

// Reusable HTML parser - created once, used for all files
const htmlParser = unified().use(rehypeParse, { fragment: false })

// Processor factory - creates a new processor for the given options
function createProcessor(options: ResolvedOptions) {
  const linkHandler = createLinkHandler({ siteUrl: options.siteUrl, excludeRoutes: options.excludeRoutes })
  return unified()
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
}

// Cache for markdown processors keyed by siteUrl (since linkHandler depends on it)
let cachedProcessor: ReturnType<typeof createProcessor> | null = null
let cachedSiteUrl: string | null = null

/**
 * Get or create a cached markdown processor for the given options
 */
function getProcessor(options: ResolvedOptions): ReturnType<typeof createProcessor> {
  if (cachedProcessor && cachedSiteUrl === options.siteUrl) {
    return cachedProcessor
  }

  cachedProcessor = createProcessor(options)
  cachedSiteUrl = options.siteUrl
  return cachedProcessor
}

/**
 * Clone a text node
 */
function cloneText(node: Text): Text {
  return { type: 'text', value: node.value }
}

/**
 * Clone a comment node
 */
function cloneComment(node: Comment): Comment {
  return { type: 'comment', value: node.value }
}

/**
 * Clone an element node
 */
function cloneElement(node: Element): Element {
  const cloned: Element = {
    type: 'element',
    tagName: node.tagName,
    properties: node.properties ? { ...node.properties } : {},
    children: node.children.map(child => cloneElementContent(child)),
  }
  // Clone array properties like className
  if (cloned.properties?.className && Array.isArray(cloned.properties.className)) {
    cloned.properties.className = [...cloned.properties.className]
  }
  return cloned
}

/**
 * Clone an element content node (dispatches to the appropriate clone function)
 */
function cloneElementContent(node: ElementContent): ElementContent {
  switch (node.type) {
    case 'text':
      return cloneText(node)
    case 'comment':
      return cloneComment(node)
    case 'element':
      return cloneElement(node)
  }
}

/**
 * Process HTML content and convert to markdown
 */
export async function processHtml(html: string, _route: string, options: ResolvedOptions): Promise<ProcessedPage> {
  // Parse HTML to HAST using cached parser
  const hast = htmlParser.parse(html) as HastRoot

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

  // Clone the content using fast clone
  const contentClone = cloneElement(content)

  // Remove unwanted elements
  removeUnwantedElements(contentClone)

  // Get cached processor
  const processor = getProcessor(options)

  // Process the content
  // We need to wrap the element in a root node for processing
  const hastRoot: HastRoot = {
    type: 'root',
    children: [contentClone],
  }

  const mdast = (await processor.run(hastRoot)) as MdastRoot
  let markdown = processor.stringify(mdast) as string

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

// Pre-compiled regex patterns for markdown cleanup
const CLEANUP_PATTERNS = {
  // Remove lines that start with "\=" (escaped default value indicators from reference docs)
  escapedEquals: /^\s*\\=.*$/gm,
  // Remove lines that are just "{}" (empty default objects)
  emptyObjects: /^\s*\{\}\s*$/gm,
  // Remove any HTML comments that made it through
  htmlComments: /<!--\s*-->/g,
  // Remove escaped angle brackets around type annotations that are alone on a line
  escapedAngleBrackets: /^\s*\\<[^>]+>\s*$/gm,
  // Collapse multiple consecutive blank lines into one blank line
  multipleBlankLines: /\n{3,}/g,
  // Remove trailing whitespace from lines
  trailingWhitespace: /[ \t]+$/gm,
  // Match consecutive links with the same URL (cards render title and description as separate links)
  // Pattern: [text1](url)\n\n[text2](same-url)
  consecutiveSameLinks: /\[([^\]]+)\]\(([^)]+)\)\n+\[([^\]]+)\]\(\2\)/g,
}

/**
 * Clean up markdown artifacts from conversion
 */
function cleanupMarkdown(markdown: string): string {
  let result = markdown
    .replace(CLEANUP_PATTERNS.escapedEquals, '')
    .replace(CLEANUP_PATTERNS.emptyObjects, '')
    .replace(CLEANUP_PATTERNS.htmlComments, '')
    .replace(CLEANUP_PATTERNS.escapedAngleBrackets, match => match.trim())

  // Merge consecutive links with the same URL (from card components)
  // Keep applying until no more matches (handles chains of 3+ links)
  let prev = ''
  while (prev !== result) {
    prev = result
    result = result.replace(CLEANUP_PATTERNS.consecutiveSameLinks, '[$1]($2): $3')
  }

  return result.replace(CLEANUP_PATTERNS.multipleBlankLines, '\n\n').replace(CLEANUP_PATTERNS.trailingWhitespace, '')
}
