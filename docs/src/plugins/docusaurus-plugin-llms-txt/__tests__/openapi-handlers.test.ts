import { describe, it, expect } from 'vitest'

import { processHtml } from '../html-processor'
import { resolveOptions } from '../options'

// Fragments mirror the markup docusaurus-theme-openapi-docs renders on Gateway API pages.
const options = resolveOptions({ siteUrl: 'https://mastra.ai' })

async function convert(body: string): Promise<string> {
  const { llmsTxt } = await processHtml(`<html><body><article>${body}</article></body></html>`, '/test', options)
  return llmsTxt
}

const required = '<span class=openapi-schema__divider></span><span class=openapi-schema__required>required</span>'

function property(name: string, type: string, extra = '', description = ''): string {
  return `<div class=openapi-schema__list-item><div><span class=openapi-schema__container><strong class=openapi-schema__property>${name}</strong><span class=openapi-schema__name>${type}</span>${extra}</span>${description}</div></div>`
}

function objectProperty(name: string, type: string, inner: string, extra = ''): string {
  return `<div class=openapi-schema__list-item><details class="openapi-markdown__details" data-collapsed=true><summary><span class=openapi-schema__container><strong class=openapi-schema__property>${name}</strong><span class=openapi-schema__name> <!-- -->${type}</span>${extra}</span></summary><div><div><div style=margin-left:1rem>${inner}</div></div></div></details></div>`
}

function tabs(container: string, labels: string[], panels: string[]): string {
  const list = labels.map(label => `<li role=tab class="tabs__item"><span>${label}</span></li>`).join('')
  const content = panels.map(panel => `<div role=tabpanel>${panel}</div>`).join('')
  return `<div class=${container}><div><ul role=tablist class="tabs">${list}</ul></div><div>${content}</div></div>`
}

describe('OpenAPI schema properties', () => {
  it('renders name, type, flags and description on one line', async () => {
    const md = await convert(
      `<ul>${property('model', 'string', required, '<p>A video model ID.<p><strong>Possible values:</strong> <code>non-empty</code>')}</ul>`,
    )

    expect(md).toBe('- **model** (`string`, required): A video model ID.\n\n  **Possible values:** `non-empty`')
  })

  it('keeps nested properties nested and drops array brackets', async () => {
    const inner =
      '<div style=margin-top:.5rem><p>Chat messages.</div>' +
      '<li><div>Array [</div></li>' +
      property('role', 'string', required) +
      property('content', 'string') +
      '<li><div>]</div></li>'
    const md = await convert(`<ul>${objectProperty('messages', 'object[]', inner, required)}</ul>`)

    expect(md).toBe(
      '- **messages** (`object[]`, required): Chat messages.\n' +
        '  - **role** (`string`, required)\n' +
        '  - **content** (`string`)',
    )
  })

  it('labels oneOf variants, including unnamed primitive variants', async () => {
    const variants = tabs(
      'openapi-tabs__schema-container',
      ['string', 'object'],
      [`<ul>${property('', 'string')}</ul>`, `<ul>${property('type', 'string')}</ul>`],
    )
    const md = await convert(
      `<ul>${objectProperty('error', 'object', `<span class="badge badge--info">anyOf</span>${variants}`)}</ul>`,
    )

    expect(md).toBe(
      '- **error** (`object`)\n\n' +
        '  Any of:\n\n' +
        '  **string**:\n' +
        '  - `string`\n\n' +
        '  **object**:\n' +
        '  - **type** (`string`)',
    )
  })
})

describe('OpenAPI collapsibles and tabs', () => {
  it('renders a parameter collapsible as a bold label without details markup', async () => {
    const md = await convert(
      `<details class="openapi-markdown__details" open><summary><h3>Query Parameters</h3></summary><div><ul>` +
        `<div class=openapi-params__list-item><span class=openapi-schema__container><strong class=openapi-schema__property>limit</strong><span class=openapi-schema__type> integer</span></span><div><strong>Default value: </strong><code>20</code></div></div>` +
        `</ul></div></details>`,
    )

    expect(md).toBe('**Query Parameters**\n\n- **limit** (`integer`)\n\n  **Default value:** `20`')
  })

  it('writes each response tab under its status code and skips labels repeated by the panel', async () => {
    const schema = `<details class="openapi-markdown__details response" open><summary><strong>Schema</strong></summary><div><ul>${property('id', 'string', required)}</ul></div></details>`
    const response = tabs('openapi-tabs__schema-container', ['Schema'], [schema])
    const md = await convert(
      tabs('openapi-tabs__container', ['202', '429'], [`<p>Accepted.</p>${response}`, '<p>Rate limited.</p>']),
    )

    expect(md).toBe('**202**:\n\nAccepted.\n\n**Schema**\n\n- **id** (`string`, required)\n\n**429**:\n\nRate limited.')
  })
})
