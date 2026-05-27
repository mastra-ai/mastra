/**
 * remark-model-tokens
 *
 * A remark plugin that replaces `__MODEL_TOKEN__` placeholders with
 * their concrete values inside fenced code blocks, inline code, and
 * plain text nodes. Token → value mappings live in ./models.ts so
 * every doc page stays in sync when a model generation changes.
 */

import { visit } from 'unist-util-visit'
import type { Root } from 'mdast'
import { MODEL_TOKENS } from './models'

const TOKEN_RE = new RegExp(
  Object.keys(MODEL_TOKENS)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'g',
)

function replaceTokens(value: string): string {
  return value.replace(TOKEN_RE, match => MODEL_TOKENS[match] ?? match)
}

export default function remarkModelTokens() {
  return (tree: Root) => {
    visit(tree, node => {
      if (
        (node.type === 'code' || node.type === 'inlineCode' || node.type === 'text') &&
        'value' in node &&
        typeof node.value === 'string' &&
        TOKEN_RE.test(node.value)
      ) {
        // Reset the regex lastIndex since we use the `g` flag for test()
        TOKEN_RE.lastIndex = 0
        node.value = replaceTokens(node.value)
      }
    })
  }
}
