import { afterEach, describe, expect, test, vi } from 'vitest'
import { API_HOST } from '../constants'
import { loadSpec, transformSpec } from '../generate'
import { GATEWAY_API_PAGES } from '../pages'

type Spec = Parameters<typeof transformSpec>[0]

/** A spec with one POST per mapped operation, each with the request fields `pages.ts` describes. */
function buildSpec(): Spec {
  const paths: Spec['paths'] = {}
  const schemas: Record<string, unknown> = {}
  for (const [id, page] of Object.entries(GATEWAY_API_PAGES)) {
    const properties = Object.fromEntries(Object.keys(page.fields ?? {}).map(field => [field, { type: 'string' }]))
    schemas[`${id}Request`] = { type: 'object', properties }
    paths[`/v1/${id}`] = {
      post: {
        operationId: id,
        requestBody: { content: { 'application/json': { schema: { $ref: `#/components/schemas/${id}Request` } } } },
        responses: {},
      },
    }
  }
  paths['/health'] = { get: { operationId: 'getHealth', responses: {} } }
  paths['/ready'] = { get: { operationId: 'getReadiness', responses: {} } }
  paths['/openapi.json'] = { get: { operationId: 'getOpenApi', responses: {} } }
  return { openapi: '3.1.0', servers: [{ url: '/' }], paths, components: { schemas } }
}

const requestSchema = (spec: Spec, id: string) =>
  (spec.components as { schemas: Record<string, { properties: Record<string, Record<string, unknown>> }> }).schemas[
    `${id}Request`
  ]

describe('transformSpec', () => {
  test('drops infrastructure operations and their now-empty paths', () => {
    const { spec } = transformSpec(buildSpec())
    expect(spec.paths['/health']).toBeUndefined()
    expect(spec.paths['/ready']).toBeUndefined()
    expect(spec.paths['/openapi.json']).toBeUndefined()
    expect(Object.keys(spec.paths)).toHaveLength(Object.keys(GATEWAY_API_PAGES).length)
  })

  test('keeps other operations on a path that loses an excluded one', () => {
    const source = buildSpec()
    source.paths['/health'] = { ...source.paths['/health'], post: { operationId: 'pingHealth', responses: {} } }
    const { spec, unmapped } = transformSpec(source)
    expect(Object.keys(spec.paths['/health'])).toEqual(['post'])
    expect(unmapped).toEqual(['pingHealth'])
  })

  test('points servers at the public API host', () => {
    expect(transformSpec(buildSpec()).spec.servers).toEqual([{ url: API_HOST, description: 'Mastra Gateway' }])
  })

  test('reports operations without a pages.ts entry', () => {
    const source = buildSpec()
    source.paths['/v1/new'] = { post: { operationId: 'createSomethingNew', responses: {} } }
    expect(transformSpec(source).unmapped).toEqual(['createSomethingNew'])
  })

  test('fails when an operation listed in pages.ts is gone from the spec', () => {
    const source = buildSpec()
    delete source.paths['/v1/createVideo']
    expect(() => transformSpec(source)).toThrow(/no longer has createVideo/)
  })

  test('fails when an operation has no operationId', () => {
    const source = buildSpec()
    source.paths['/v1/anonymous'] = { get: { responses: {} } }
    expect(() => transformSpec(source)).toThrow('GET /v1/anonymous has no operationId')
  })

  test('fills undescribed request fields and keeps descriptions the spec already has', () => {
    const source = buildSpec()
    requestSchema(source, 'createVideo').properties.seed.description = 'From the spec.'
    const { spec } = transformSpec(source)
    const { properties } = requestSchema(spec, 'createVideo')
    expect(properties.seed.description).toBe('From the spec.')
    expect(properties.generate_audio.description).toBe(GATEWAY_API_PAGES.createVideo.fields!.generate_audio)
  })

  test('wraps referenced request fields in allOf to describe them', () => {
    const source = buildSpec()
    requestSchema(source, 'createVideo').properties.resolution = { $ref: '#/components/schemas/Resolution' }
    const { spec } = transformSpec(source)
    expect(requestSchema(spec, 'createVideo').properties.resolution).toEqual({
      allOf: [{ $ref: '#/components/schemas/Resolution' }],
      description: GATEWAY_API_PAGES.createVideo.fields!.resolution,
    })
  })

  test('keeps the spec description of a referenced request field', () => {
    const source = buildSpec()
    requestSchema(source, 'createVideo').properties.resolution = {
      $ref: '#/components/schemas/Resolution',
      description: 'From the spec.',
    }
    const { spec } = transformSpec(source)
    expect(requestSchema(spec, 'createVideo').properties.resolution.description).toBe('From the spec.')
  })

  test('fails when pages.ts describes a request field the spec no longer has', () => {
    const source = buildSpec()
    delete requestSchema(source, 'createVideo').properties.seed
    expect(() => transformSpec(source)).toThrow('createVideo (application/json) has no request field "seed"')
  })

  test('fails when pages.ts describes fields of an operation that lost its request body', () => {
    const source = buildSpec()
    delete (source.paths['/v1/createVideo'].post as { requestBody?: unknown }).requestBody
    expect(() => transformSpec(source)).toThrow('createVideo has no inline request body')
  })

  test('does not modify the source document', () => {
    const source = buildSpec()
    const copy = structuredClone(source)
    transformSpec(source)
    expect(source).toEqual(copy)
  })
})

describe('loadSpec', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test('falls back to the committed snapshot when the spec cannot be fetched', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', fetchMock)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const pending = loadSpec('https://gateway-api.example/openapi.json')
    await vi.runAllTimersAsync()
    const spec = await pending

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('openapi.snapshot.json'))
    expect(spec.openapi).toMatch(/^3\./)
    expect(() => transformSpec(spec)).not.toThrow()
  })
})
