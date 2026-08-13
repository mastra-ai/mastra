import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import type { Element, Root } from 'hast'

import { removeUnwantedElements } from '../content-extractor'

function parseHtml(html: string): Element {
  const tree = unified().use(rehypeParse, { fragment: true }).parse(html) as Root
  const element = tree.children.find(child => child.type === 'element')

  if (!element) {
    throw new Error('No element found in parsed HTML')
  }

  return element
}

describe('removeUnwantedElements', () => {
  it('removes elements marked with data-llms-ignore', () => {
    const node = parseHtml(`
      <main>
        <label data-llms-ignore>
          Search integrations...
          <input type="search" />
        </label>
        <section>Integration content</section>
      </main>
    `)

    removeUnwantedElements(node)

    const elements = node.children.filter(child => child.type === 'element')

    expect(elements).toHaveLength(1)
    expect(elements[0]).toMatchObject({ type: 'element', tagName: 'section' })
  })
})
