import { describe, expect, test } from 'vitest'
import { SPEC_URL } from '../constants'
import { createGatewayApiPageMD } from '../markdown'
import { GATEWAY_API_PAGES } from '../pages'

type Item = Parameters<typeof createGatewayApiPageMD>[0]

function apiItem(operationId: string, path: string): Item {
  return {
    type: 'api',
    id: operationId,
    title: 'Spec summary',
    description: 'Spec description',
    frontMatter: { description: 'Spec description' },
    api: {
      operationId,
      method: 'post',
      path,
      description: 'Description from the spec.',
      responses: { '200': { description: 'OK' } },
    },
  } as unknown as Item
}

describe('createGatewayApiPageMD', () => {
  test('applies the title, description, and slug from pages.ts', () => {
    const item = apiItem('createVideo', '/v1/videos')
    createGatewayApiPageMD(item)
    const page = GATEWAY_API_PAGES.createVideo
    expect(item.title).toBe(page.title)
    expect(item.gatewayFrontMatter).toBe(
      [
        `title: ${JSON.stringify(`${page.title} | Gateway`)}`,
        `description: ${JSON.stringify(page.description)}`,
        'slug: "/mastra-platform/gateway/api/videos"',
      ].join('\n'),
    )
  })

  test('renders the agent note, then the guide, then the spec description', () => {
    const markdown = createGatewayApiPageMD(apiItem('createVideo', '/v1/videos'))
    expect(markdown.startsWith("import Guide from './_guides/videos.mdx'\n")).toBe(true)
    const note = markdown.indexOf('<Inject>')
    const guide = markdown.indexOf('<Guide />')
    const description = markdown.indexOf('Description from the spec.')
    expect(note).toBeGreaterThan(-1)
    expect(guide).toBeGreaterThan(note)
    expect(description).toBeGreaterThan(guide)
    expect(markdown).toContain(`[${SPEC_URL}](${SPEC_URL})`)
    expect(markdown).not.toContain('GATEWAYAPIGUIDESLOT')
  })

  test('points the agent note at the compatible provider reference', () => {
    const { compatibleWith } = GATEWAY_API_PAGES.createChatCompletion
    const markdown = createGatewayApiPageMD(apiItem('createChatCompletion', '/v1/chat/completions'))
    expect(markdown).toContain(`[${compatibleWith!.name}](${compatibleWith!.url})`)
  })

  test('leaves out the compatibility sentence for endpoints without one', () => {
    const markdown = createGatewayApiPageMD(apiItem('createVideo', '/v1/videos'))
    expect(GATEWAY_API_PAGES.createVideo.compatibleWith).toBeUndefined()
    expect(markdown).not.toContain('which this endpoint is compatible with')
  })

  test('keeps MDX in the guide slot unescaped while escaping the spec description', () => {
    const item = apiItem('createVideo', '/v1/videos')
    item.api.description = 'Accepts <video> and {json}.'
    const markdown = createGatewayApiPageMD(item)
    expect(markdown).toContain('<Guide />')
    expect(markdown).not.toContain('Accepts <video> and {json}.')
  })

  test('falls back to the spec for operations missing from pages.ts', () => {
    const item = apiItem('createSomethingNew', '/v1/new')
    const markdown = createGatewayApiPageMD(item)
    expect(item.title).toBe('Spec summary')
    expect(item.gatewayFrontMatter).toBe('title: "Spec summary | Gateway"\ndescription: "Spec description"')
    expect(markdown).not.toContain('import Guide')
    expect(markdown).not.toContain('<Guide />')
    expect(markdown).toContain('<Inject>')
  })

  test('does not modify the API data written into the page', () => {
    const item = apiItem('createVideo', '/v1/videos')
    createGatewayApiPageMD(item)
    expect(item.api.description).toBe('Description from the spec.')
  })
})
