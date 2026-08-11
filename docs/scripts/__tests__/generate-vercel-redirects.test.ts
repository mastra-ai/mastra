import { describe, expect, test } from 'vitest'
import { generateRedirects, isInternalDocsDestination, toLlmsTxtPath } from '../generate-vercel-redirects.mjs'

describe('toLlmsTxtPath', () => {
  test('adds the suffix to a path without a fragment', () => {
    expect(toLlmsTxtPath('/docs/agents/overview')).toBe('/docs/agents/overview/llms.txt')
  })

  test('places the suffix before a fragment', () => {
    expect(toLlmsTxtPath('/docs/agent-controller/overview#sessions-and-threads')).toBe(
      '/docs/agent-controller/overview/llms.txt#sessions-and-threads',
    )
  })

  test('preserves additional fragment delimiters', () => {
    expect(toLlmsTxtPath('/docs/page#one#two')).toBe('/docs/page/llms.txt#one#two')
  })

  test('removes a trailing slash before adding the suffix', () => {
    expect(toLlmsTxtPath('/docs/agents/overview/')).toBe('/docs/agents/overview/llms.txt')
  })

  test('does not add the suffix twice', () => {
    expect(toLlmsTxtPath('/docs/agents/overview/llms.txt')).toBe('/docs/agents/overview/llms.txt')
    expect(toLlmsTxtPath('/docs/agents/overview/llms.txt#usage')).toBe('/docs/agents/overview/llms.txt#usage')
  })
})

describe('generateRedirects', () => {
  test('creates fragment-safe companions for internal destinations', () => {
    expect(
      generateRedirects([
        {
          source: '/docs/agent-controller/session',
          destination: '/docs/agent-controller/overview#sessions-and-threads',
          permanent: true,
        },
      ]),
    ).toEqual([
      {
        source: '/docs/agent-controller/session',
        destination: '/docs/agent-controller/overview#sessions-and-threads',
        permanent: true,
      },
      {
        source: '/docs/agent-controller/session/llms.txt',
        destination: '/docs/agent-controller/overview/llms.txt#sessions-and-threads',
        permanent: true,
      },
    ])
  })

  test('does not create companions for external destinations', () => {
    const redirect = {
      source: '/docs/external',
      destination: 'https://example.com/docs',
      permanent: true,
    }

    expect(isInternalDocsDestination(redirect.destination)).toBe(false)
    expect(generateRedirects([redirect])).toEqual([redirect])
  })

  test('rejects redirect chains', () => {
    expect(() =>
      generateRedirects([
        { source: '/guides/old', destination: '/docs/channels/slack', permanent: true },
        { source: '/docs/channels/slack', destination: '/integrations/channels/slack', permanent: true },
      ]),
    ).toThrow('Redirect chain detected: /guides/old -> /docs/channels/slack -> /integrations/channels/slack')
  })

  test('detects redirect chains when the intermediate destination has a fragment', () => {
    expect(() =>
      generateRedirects([
        { source: '/guides/old', destination: '/docs/new#section', permanent: true },
        { source: '/docs/new', destination: '/integrations/new', permanent: true },
      ]),
    ).toThrow('Redirect chain detected: /guides/old -> /docs/new#section -> /integrations/new')
  })

  test('rejects duplicate authored sources', () => {
    expect(() =>
      generateRedirects([
        { source: '/docs/old', destination: '/docs/new', permanent: true },
        { source: '/docs/old', destination: '/docs/newer', permanent: true },
      ]),
    ).toThrow('Duplicate redirect source: /docs/old')
  })

  test('rejects collisions with generated companion sources', () => {
    expect(() =>
      generateRedirects([
        { source: '/docs/old', destination: '/docs/new', permanent: true },
        { source: '/docs/old/llms.txt', destination: '/docs/new', permanent: true },
      ]),
    ).toThrow('Duplicate redirect source: /docs/old/llms.txt')
  })
})
