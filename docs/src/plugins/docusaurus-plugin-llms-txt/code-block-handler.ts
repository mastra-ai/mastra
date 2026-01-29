/**
 * Custom handler for code blocks to preserve language hints
 *
 * Docusaurus places language classes on <pre> elements (e.g., <pre class="language-typescript">), not on <code> elements. The default rehype-remark handler only checks <code> elements, so we need a custom handler to extract the language from the <pre> element.
 */

import type { Element, Text } from 'hast'
import type { Code } from 'mdast'
import type { State } from 'hast-util-to-mdast'

/**
 * Extract language identifier from className array
 */
function extractLanguage(classNames: string[] | undefined): string | undefined {
  if (!classNames) return undefined

  for (const className of classNames) {
    if (className.startsWith('language-')) {
      return className.slice('language-'.length)
    }
  }

  return undefined
}

/**
 * Recursively extract text content from HAST nodes
 */
function extractTextContent(node: Element | Text): string {
  if (node.type === 'text') {
    return node.value
  }

  if (node.type === 'element') {
    // Handle <br> as newline
    if (node.tagName === 'br') {
      return '\n'
    }

    // Recursively get text from children
    return (node.children || [])
      .map(child => {
        if (child.type === 'text' || child.type === 'element') {
          return extractTextContent(child as Element | Text)
        }
        return ''
      })
      .join('')
  }

  return ''
}

/**
 * Custom handler for <pre> elements to preserve language metadata
 */
export function handleCodeBlock(_state: State, node: Element): Code {
  // Get className from <pre> element
  const preClassNames = node.properties?.className as string[] | undefined

  // Find the <code> child element
  const codeElement = node.children.find(
    (child): child is Element => child.type === 'element' && child.tagName === 'code',
  )

  // Try to get language from <pre> first, then from <code>
  let lang = extractLanguage(preClassNames)
  if (!lang && codeElement) {
    const codeClassNames = codeElement.properties?.className as string[] | undefined
    lang = extractLanguage(codeClassNames)
  }

  // Also check parent div for language class (Docusaurus sometimes puts it there)
  // This is handled at a higher level, so we don't need to worry about it here

  // Extract code content
  const code = codeElement ? extractTextContent(codeElement) : extractTextContent(node)

  return {
    type: 'code',
    lang: lang || null,
    meta: null,
    value: code.trim(),
  }
}
