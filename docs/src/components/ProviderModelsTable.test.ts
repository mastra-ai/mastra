import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ProviderModelsTable from './ProviderModelsTable'

describe('ProviderModelsTable', () => {
  it('distinguishes unknown capabilities from unsupported ones and labels catalog membership', () => {
    const html = renderToStaticMarkup(
      createElement(ProviderModelsTable, {
        catalogOnly: true,
        models: [
          {
            model: 'opencode-console/local-model',
            imageInput: null,
            toolUsage: null,
            audioInput: false,
            videoInput: false,
            reasoning: true,
            contextWindow: 200000,
          },
        ],
      }),
    )
    expect(html.match(/aria-label="Unknown"/g)).toHaveLength(2)
    expect(html.match(/aria-label="Unsupported"/g)).toHaveLength(2)
    expect(html.match(/aria-label="Supported"/g)).toHaveLength(1)
    expect(html).toContain('1 catalog entry; availability depends on account eligibility')
    expect(html).not.toContain('1 available model')
  })

  it('preserves the available-model caption for existing providers', () => {
    const html = renderToStaticMarkup(
      createElement(ProviderModelsTable, {
        models: [{ model: 'existing/model', imageInput: false, toolUsage: true }],
      }),
    )
    expect(html).toContain('1 available model')
  })

  it('shows omitted extended capabilities as unknown without changing explicit unsupported values', () => {
    const html = renderToStaticMarkup(
      createElement(ProviderModelsTable, {
        models: [
          {
            model: 'provider/extended-model',
            imageInput: true,
            toolUsage: true,
            reasoning: true,
            audioInput: false,
            videoInput: false,
          },
          {
            model: 'provider/sparse-model',
            imageInput: false,
            toolUsage: false,
          },
        ],
      }),
    )

    expect(html.match(/aria-label="Unknown"/g)).toHaveLength(3)
    expect(html.match(/aria-label="Unsupported"/g)).toHaveLength(4)
  })
})
