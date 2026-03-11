import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import remarkStringify from 'remark-stringify'
import type { Element } from 'hast'

import { isPropertiesTable, handlePropertiesTable } from '../component-handlers'

// Helper: parse HTML fragment into a hast Element
function parseHtml(html: string): Element {
  const tree = unified().use(rehypeParse, { fragment: true }).parse(html)
  // Return the first element child
  for (const child of tree.children) {
    if (child.type === 'element') return child
  }
  throw new Error('No element found in parsed HTML')
}

// Helper: convert mdast nodes to markdown string
function toMarkdown(nodes: ReturnType<typeof handlePropertiesTable>): string {
  const mdastNodes = Array.isArray(nodes) ? nodes : [nodes]
  const root = { type: 'root' as const, children: mdastNodes as any[] }
  return unified().use(remarkStringify).stringify(root).trim()
}

// Minimal mock state (handlePropertiesTable doesn't use state)
const mockState = {} as any

describe('isPropertiesTable', () => {
  it('detects element with data-testid="properties-table"', () => {
    const node = parseHtml('<div data-testid="properties-table"></div>')
    expect(isPropertiesTable(node)).toBe(true)
  })

  it('rejects element without data-testid', () => {
    const node = parseHtml('<div class="flex flex-col"></div>')
    expect(isPropertiesTable(node)).toBe(false)
  })

  it('rejects element with wrong data-testid', () => {
    const node = parseHtml('<div data-testid="something-else"></div>')
    expect(isPropertiesTable(node)).toBe(false)
  })
})

describe('handlePropertiesTable', () => {
  it('extracts a single property with name, type, and description', () => {
    const html = `
      <div data-testid="properties-table">
        <div data-testid="property-row" id="name">
          <div>
            <h3 data-testid="property-name">name<span>:</span></h3>
            <div data-testid="property-type">string</div>
          </div>
          <div data-testid="property-description">The agent name.</div>
        </div>
      </div>
    `
    const node = parseHtml(html)
    const md = toMarkdown(handlePropertiesTable(mockState, node))
    expect(md).toBe('**name** (`string`): The agent name.')
  })

  it('extracts optional property (strips ?:)', () => {
    const html = `
      <div data-testid="properties-table">
        <div data-testid="property-row" id="model">
          <div>
            <h3 data-testid="property-name">model<span>?:</span></h3>
            <div data-testid="property-type">string</div>
          </div>
          <div data-testid="property-description">The model to use.</div>
        </div>
      </div>
    `
    const node = parseHtml(html)
    const md = toMarkdown(handlePropertiesTable(mockState, node))
    expect(md).toBe('**model** (`string`): The model to use.')
  })

  it('extracts property with default value', () => {
    const html = `
      <div data-testid="properties-table">
        <div data-testid="property-row" id="timeout">
          <div>
            <h3 data-testid="property-name">timeout<span>?:</span></h3>
            <div data-testid="property-type">number</div>
            <div data-testid="property-default">= 30000</div>
          </div>
          <div data-testid="property-description">Timeout in milliseconds.</div>
        </div>
      </div>
    `
    const node = parseHtml(html)
    const md = toMarkdown(handlePropertiesTable(mockState, node))
    expect(md).toBe('**timeout** (`number`): Timeout in milliseconds. (Default: `30000`)')
  })

  it('extracts multiple properties', () => {
    const html = `
      <div data-testid="properties-table">
        <div data-testid="property-row" id="name">
          <div>
            <h3 data-testid="property-name">name<span>:</span></h3>
            <div data-testid="property-type">string</div>
          </div>
          <div data-testid="property-description">The name.</div>
        </div>
        <div data-testid="property-row" id="age">
          <div>
            <h3 data-testid="property-name">age<span>:</span></h3>
            <div data-testid="property-type">number</div>
          </div>
          <div data-testid="property-description">The age.</div>
        </div>
      </div>
    `
    const node = parseHtml(html)
    const md = toMarkdown(handlePropertiesTable(mockState, node))
    expect(md).toContain('**name** (`string`): The name.')
    expect(md).toContain('**age** (`number`): The age.')
  })

  it('handles nested properties with parent prefix', () => {
    const html = `
      <div data-testid="properties-table">
        <div data-testid="property-row" id="options">
          <div>
            <h3 data-testid="property-name">options<span>?:</span></h3>
            <div data-testid="property-type">MemoryConfig</div>
          </div>
          <div data-testid="property-description">Memory configuration options.</div>
          <div data-testid="property-nested">
            <div>
              <div>
                <div data-testid="property-row">
                  <div>
                    <h3 data-testid="property-name">lastMessages<span>?:</span></h3>
                    <div data-testid="property-type">number | false</div>
                  </div>
                  <div data-testid="property-description">Number of recent messages to include.</div>
                </div>
                <div data-testid="property-row">
                  <div>
                    <h3 data-testid="property-name">readOnly<span>?:</span></h3>
                    <div data-testid="property-type">boolean</div>
                  </div>
                  <div data-testid="property-description">Prevent saving new messages.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
    const node = parseHtml(html)
    const md = toMarkdown(handlePropertiesTable(mockState, node))
    expect(md).toContain('**options** (`MemoryConfig`): Memory configuration options.')
    expect(md).toContain('**options.lastMessages** (`number | false`): Number of recent messages to include.')
    expect(md).toContain('**options.readOnly** (`boolean`): Prevent saving new messages.')
  })

  it('handles deeply nested properties (3 levels)', () => {
    const html = `
      <div data-testid="properties-table">
        <div data-testid="property-row" id="config">
          <div>
            <h3 data-testid="property-name">config<span>:</span></h3>
            <div data-testid="property-type">Config</div>
          </div>
          <div data-testid="property-description">Top-level config.</div>
          <div data-testid="property-nested">
            <div><div>
              <div data-testid="property-row">
                <div>
                  <h3 data-testid="property-name">auth<span>:</span></h3>
                  <div data-testid="property-type">AuthConfig</div>
                </div>
                <div data-testid="property-description">Auth settings.</div>
                <div data-testid="property-nested">
                  <div><div>
                    <div data-testid="property-row">
                      <div>
                        <h3 data-testid="property-name">token<span>:</span></h3>
                        <div data-testid="property-type">string</div>
                      </div>
                      <div data-testid="property-description">The auth token.</div>
                    </div>
                  </div></div>
                </div>
              </div>
            </div></div>
          </div>
        </div>
      </div>
    `
    const node = parseHtml(html)
    const md = toMarkdown(handlePropertiesTable(mockState, node))
    expect(md).toContain('**config** (`Config`): Top-level config.')
    expect(md).toContain('**config.auth** (`AuthConfig`): Auth settings.')
    expect(md).toContain('**config.auth.token** (`string`): The auth token.')
  })

  it('handles property with no type', () => {
    const html = `
      <div data-testid="properties-table">
        <div data-testid="property-row" id="data">
          <div>
            <h3 data-testid="property-name">data<span>:</span></h3>
          </div>
          <div data-testid="property-description">Some data.</div>
        </div>
      </div>
    `
    const node = parseHtml(html)
    const md = toMarkdown(handlePropertiesTable(mockState, node))
    expect(md).toBe('**data**: Some data.')
  })

  it('handles property with no description', () => {
    const html = `
      <div data-testid="properties-table">
        <div data-testid="property-row" id="id">
          <div>
            <h3 data-testid="property-name">id<span>:</span></h3>
            <div data-testid="property-type">string</div>
          </div>
        </div>
      </div>
    `
    const node = parseHtml(html)
    const md = toMarkdown(handlePropertiesTable(mockState, node))
    expect(md).toBe('**id** (`string`)')
  })

  it('handles mix of top-level and nested properties', () => {
    const html = `
      <div data-testid="properties-table">
        <div data-testid="property-row" id="storage">
          <div>
            <h3 data-testid="property-name">storage<span>?:</span></h3>
            <div data-testid="property-type">MastraCompositeStore</div>
          </div>
          <div data-testid="property-description">Storage implementation.</div>
        </div>
        <div data-testid="property-row" id="options">
          <div>
            <h3 data-testid="property-name">options<span>?:</span></h3>
            <div data-testid="property-type">MemoryConfig</div>
          </div>
          <div data-testid="property-description">Configuration options.</div>
          <div data-testid="property-nested">
            <div><div>
              <div data-testid="property-row">
                <div>
                  <h3 data-testid="property-name">lastMessages<span>?:</span></h3>
                  <div data-testid="property-type">number</div>
                </div>
                <div data-testid="property-description">Recent messages count.</div>
              </div>
            </div></div>
          </div>
        </div>
        <div data-testid="property-row" id="embedder">
          <div>
            <h3 data-testid="property-name">embedder<span>?:</span></h3>
            <div data-testid="property-type">EmbeddingModel</div>
          </div>
          <div data-testid="property-description">Embedder instance.</div>
        </div>
      </div>
    `
    const node = parseHtml(html)
    const md = toMarkdown(handlePropertiesTable(mockState, node))
    const lines = md.split('\n\n')
    expect(lines).toHaveLength(4) // storage, options, options.lastMessages, embedder
    expect(lines[0]).toBe('**storage** (`MastraCompositeStore`): Storage implementation.')
    expect(lines[1]).toBe('**options** (`MemoryConfig`): Configuration options.')
    expect(lines[2]).toBe('**options.lastMessages** (`number`): Recent messages count.')
    expect(lines[3]).toBe('**embedder** (`EmbeddingModel`): Embedder instance.')
  })

  it('does not pick up nested property values for parent row', () => {
    // Verifies that findByTestId stops at property-row/property-nested boundaries
    const html = `
      <div data-testid="properties-table">
        <div data-testid="property-row" id="parent">
          <div>
            <h3 data-testid="property-name">parent<span>:</span></h3>
            <div data-testid="property-type">ParentType</div>
          </div>
          <div data-testid="property-description">Parent description.</div>
          <div data-testid="property-nested">
            <div><div>
              <div data-testid="property-row">
                <div>
                  <h3 data-testid="property-name">child<span>:</span></h3>
                  <div data-testid="property-type">ChildType</div>
                </div>
                <div data-testid="property-description">Child description.</div>
              </div>
            </div></div>
          </div>
        </div>
      </div>
    `
    const node = parseHtml(html)
    const md = toMarkdown(handlePropertiesTable(mockState, node))
    // Parent should have its own values, not child's
    expect(md).toContain('**parent** (`ParentType`): Parent description.')
    expect(md).toContain('**parent.child** (`ChildType`): Child description.')
    // Make sure child type didn't leak into parent
    expect(md).not.toContain('**parent** (`ChildType`)')
  })

  it('returns empty array for properties-table with no rows', () => {
    const html = `<div data-testid="properties-table"></div>`
    const node = parseHtml(html)
    const result = handlePropertiesTable(mockState, node)
    expect(Array.isArray(result) ? result : [result]).toHaveLength(0)
  })
})
