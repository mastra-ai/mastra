import { describe, it, expect } from 'vitest'
import type { Element } from 'hast'
import { isAdmonition, handleAdmonition } from '../admonition-handler'
import { toMdast } from 'hast-util-to-mdast'
import { unified } from 'unified'
import remarkStringify from 'remark-stringify'
import type { Root as HastRoot } from 'hast'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal admonition hast tree matching the real rendered HTML */
function makeAdmonition(type: string, contentHtml: Element['children']): Element {
  return {
    type: 'element',
    tagName: 'div',
    properties: {
      className: ['mb-4', 'flex', 'admonition-container', 'bg-green-100/50'],
    },
    children: [
      // Title row
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['flex', 'items-center', 'gap-1.5'] },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['size-3', 'shrink-0'] },
            children: [{ type: 'text', value: '' }],
          },
          {
            type: 'element',
            tagName: 'span',
            properties: {
              className: ['font-mono', 'text-sm'],
              dataTestid: 'admonition-title',
            },
            children: [{ type: 'text', value: type }],
          },
        ],
      },
      // Content div
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['text-sm'] },
        children: contentHtml,
      },
    ],
  }
}

/** Convert a hast Element through the handler and return markdown */
function toMd(node: Element): string {
  const hast: HastRoot = {
    type: 'root',
    children: [node],
  }

  const mdast = toMdast(hast, {
    handlers: {
      div(state, node) {
        if (isAdmonition(node)) {
          return handleAdmonition(state, node)
        }
        const children: any[] = []
        for (const child of node.children) {
          const result = state.one(child, node)
          if (result) {
            if (Array.isArray(result)) children.push(...result)
            else children.push(result)
          }
        }
        return children
      },
    },
  })

  return unified()
    .use(remarkStringify, { bullet: '-', emphasis: '_', fences: true })
    .stringify(mdast as any)
    .trim()
}

// ---------------------------------------------------------------------------
// isAdmonition
// ---------------------------------------------------------------------------

describe('isAdmonition', () => {
  it('returns true when the div has the admonition-container class', () => {
    const node = makeAdmonition('note', [])
    expect(isAdmonition(node)).toBe(true)
  })

  it('returns false for a plain div', () => {
    const node: Element = {
      type: 'element',
      tagName: 'div',
      properties: { className: ['some-other-class'] },
      children: [],
    }
    expect(isAdmonition(node)).toBe(false)
  })

  it('returns false when className is missing', () => {
    const node: Element = {
      type: 'element',
      tagName: 'div',
      properties: {},
      children: [],
    }
    expect(isAdmonition(node)).toBe(false)
  })

  it('handles className as a space-separated string', () => {
    const node: Element = {
      type: 'element',
      tagName: 'div',
      properties: { className: 'mb-4 admonition-container bg-green-100/50' },
      children: [],
    }
    expect(isAdmonition(node)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// handleAdmonition
// ---------------------------------------------------------------------------

describe('handleAdmonition', () => {
  it('converts a note admonition to a blockquote with bold title', () => {
    const node = makeAdmonition('note', [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [{ type: 'text', value: 'This is important.' }],
      },
    ])

    const md = toMd(node)
    expect(md).toBe('> **Note:** This is important.')
  })

  it('capitalizes the first letter of the title', () => {
    const node = makeAdmonition('warning', [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [{ type: 'text', value: 'Be careful.' }],
      },
    ])

    const md = toMd(node)
    expect(md).toBe('> **Warning:** Be careful.')
  })

  it('preserves inline elements in content', () => {
    const node = makeAdmonition('tip', [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [
          { type: 'text', value: 'Use ' },
          {
            type: 'element',
            tagName: 'code',
            properties: {},
            children: [{ type: 'text', value: 'agent.stream()' }],
          },
          { type: 'text', value: ' for real-time output.' },
        ],
      },
    ])

    const md = toMd(node)
    expect(md).toBe('> **Tip:** Use `agent.stream()` for real-time output.')
  })

  it('preserves links in content', () => {
    const node = makeAdmonition('note', [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [
          { type: 'text', value: 'See the ' },
          {
            type: 'element',
            tagName: 'a',
            properties: { href: '/models' },
            children: [{ type: 'text', value: 'full list' }],
          },
          { type: 'text', value: '.' },
        ],
      },
    ])

    const md = toMd(node)
    expect(md).toBe('> **Note:** See the [full list](/models).')
  })

  it('handles multiple paragraphs', () => {
    const node = makeAdmonition('info', [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [{ type: 'text', value: 'First paragraph.' }],
      },
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [{ type: 'text', value: 'Second paragraph.' }],
      },
    ])

    const md = toMd(node)
    expect(md).toContain('> **Info:** First paragraph.')
    expect(md).toContain('> Second paragraph.')
  })

  it('defaults to "Note" when title element is missing', () => {
    const node: Element = {
      type: 'element',
      tagName: 'div',
      properties: { className: ['admonition-container'] },
      children: [
        {
          type: 'element',
          tagName: 'div',
          properties: {},
          children: [],
        },
        {
          type: 'element',
          tagName: 'div',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'p',
              properties: {},
              children: [{ type: 'text', value: 'Fallback content.' }],
            },
          ],
        },
      ],
    }

    const md = toMd(node)
    expect(md).toBe('> **Note:** Fallback content.')
  })

  it('creates a title-only paragraph when content starts with a non-paragraph', () => {
    const node = makeAdmonition('caution', [
      {
        type: 'element',
        tagName: 'ul',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'li',
            properties: {},
            children: [{ type: 'text', value: 'Item one' }],
          },
        ],
      },
    ])

    const md = toMd(node)
    expect(md).toContain('> **Caution:**')
    expect(md).toContain('> - Item one')
  })

  it('handles custom bracket title like :::tip[Codemod]', () => {
    const node = makeAdmonition('Codemod', [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [{ type: 'text', value: 'Run the codemod to migrate.' }],
      },
    ])

    const md = toMd(node)
    expect(md).toBe('> **Codemod:** Run the codemod to migrate.')
  })

  it('handles custom space-separated title like :::tip Agent streaming', () => {
    const node = makeAdmonition('Agent streaming in workflows', [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [{ type: 'text', value: 'Agents can stream inside workflow steps.' }],
      },
    ])

    const md = toMd(node)
    expect(md).toBe('> **Agent streaming in workflows:** Agents can stream inside workflow steps.')
  })

  it('handles the :::important alias type', () => {
    const node = makeAdmonition('important', [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [{ type: 'text', value: 'This will break without it.' }],
      },
    ])

    const md = toMd(node)
    expect(md).toBe('> **Important:** This will break without it.')
  })

  it('handles content with a code block', () => {
    const node = makeAdmonition('tip', [
      {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [{ type: 'text', value: 'Example:' }],
      },
      {
        type: 'element',
        tagName: 'pre',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: { className: ['language-ts'] },
            children: [{ type: 'text', value: 'const x = 1;' }],
          },
        ],
      },
    ])

    const md = toMd(node)
    expect(md).toContain('> **Tip:** Example:')
    expect(md).toContain('const x = 1;')
  })

  it('handles empty content div', () => {
    const node = makeAdmonition('warning', [])

    const md = toMd(node)
    expect(md).toBe('> **Warning:**')
  })

  it('matches real rendered HTML from Docusaurus', () => {
    const node: Element = {
      type: 'element',
      tagName: 'div',
      properties: {
        className: [
          'mb-4',
          'flex',
          'flex-col',
          'gap-2',
          'rounded-xl',
          'border',
          'border-(--border)',
          'p-4',
          'bg-green-100/50',
          'dark:bg-green-900/30',
          'text-green-700',
          'dark:text-green-500',
          'border-green-200',
          'dark:border-green-800',
          'admonition-container',
        ],
      },
      children: [
        {
          type: 'element',
          tagName: 'div',
          properties: { className: ['flex', 'items-center', 'gap-1.5'] },
          children: [
            {
              type: 'element',
              tagName: 'span',
              properties: { className: ['size-3', 'shrink-0'] },
              children: [
                {
                  type: 'element',
                  tagName: 'svg',
                  properties: { xmlns: 'http://www.w3.org/2000/svg' },
                  children: [],
                },
              ],
            },
            {
              type: 'element',
              tagName: 'span',
              properties: {
                className: ['font-mono', 'text-sm', 'font-bold', 'tracking-tight', 'capitalize'],
                dataTestid: 'admonition-title',
              },
              children: [{ type: 'text', value: 'note' }],
            },
          ],
        },
        {
          type: 'element',
          tagName: 'div',
          properties: { className: ['text-sm', '*:last:mb-0!'] },
          children: [
            {
              type: 'element',
              tagName: 'p',
              properties: {},
              children: [
                { type: 'text', value: 'Mastra supports more than 600 models. Choose from the ' },
                {
                  type: 'element',
                  tagName: 'a',
                  properties: { className: [], href: '/models' },
                  children: [{ type: 'text', value: 'full list' }],
                },
                { type: 'text', value: '.' },
              ],
            },
          ],
        },
      ],
    }

    expect(isAdmonition(node)).toBe(true)

    const md = toMd(node)
    expect(md).toBe('> **Note:** Mastra supports more than 600 models. Choose from the [full list](/models).')
  })
})
