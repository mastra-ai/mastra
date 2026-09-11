import type { RootContent } from 'mdast'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import remarkModelTokens from '../plugins/remark-model-tokens'
import type { ApiCommentPart } from './model'
import type { CommentNode } from './presentation'

export function safeCommentUrl(url: string): string {
  if (!/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(url) || /[\u0000-\u0020\\]/.test(url)) {
    throw new Error(`Unsafe or noncanonical API comment URL: ${url}`)
  }
  return url
}

export function compileComment(parts: ApiCommentPart[], destinations: ReadonlyMap<string, string>): CommentNode[] {
  const markdown = parts
    .map(part => {
      if (part.kind !== 'inline-tag') return part.text
      const destination = part.target ? destinations.get(part.target) : undefined
      const label = part.text.replace(/[\\`\[\]]/g, '\\$&')
      return destination ? `[${label}](${safeCommentUrl(destination)})` : label
    })
    .join('')
  const parser = unified().use(remarkParse).use(remarkModelTokens)
  const tree = parser.parse(markdown)
  parser.runSync(tree)

  function convert(node: RootContent): CommentNode[] {
    switch (node.type) {
      case 'text':
        return [{ kind: 'text', value: node.value }]
      case 'inlineCode':
        return [{ kind: 'element', tag: 'code', children: [{ kind: 'text', value: node.value }] }]
      case 'code':
        return [
          {
            kind: 'code',
            value: node.value,
            ...(node.lang ? { language: node.lang } : {}),
            ...(node.meta === 'npm2yarn' ? { npm2yarn: true } : {}),
          },
        ]
      case 'link':
        return [{ kind: 'link', href: safeCommentUrl(node.url), children: node.children.flatMap(convert) }]
      case 'heading':
        return [
          {
            kind: 'element',
            tag: node.depth === 1 ? 'h4' : node.depth === 2 ? 'h5' : 'h6',
            children: node.children.flatMap(convert),
          },
        ]
      case 'paragraph':
        return [{ kind: 'element', tag: 'p', children: node.children.flatMap(convert) }]
      case 'strong':
        return [{ kind: 'element', tag: 'strong', children: node.children.flatMap(convert) }]
      case 'emphasis':
        return [{ kind: 'element', tag: 'em', children: node.children.flatMap(convert) }]
      case 'list':
        return [{ kind: 'element', tag: node.ordered ? 'ol' : 'ul', children: node.children.flatMap(convert) }]
      case 'listItem':
        return [{ kind: 'element', tag: 'li', children: node.children.flatMap(convert) }]
      case 'blockquote':
        return [{ kind: 'element', tag: 'blockquote', children: node.children.flatMap(convert) }]
      case 'break':
        return [{ kind: 'element', tag: 'br', children: [] }]
      default:
        throw new Error(`Unsupported API comment Markdown: ${node.type}`)
    }
  }

  return tree.children.flatMap(convert)
}
