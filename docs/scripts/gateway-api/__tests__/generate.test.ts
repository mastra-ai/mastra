import fs from 'fs/promises'
import path from 'path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { API_HOST, DOCS_ROOT, PAGES_DIR } from '../constants'
import { generate, loadSpec, transformSpec } from '../generate'
import { GATEWAY_API_PAGES } from '../pages'

type Spec = Parameters<typeof transformSpec>[0]

/** A spec with one POST per mapped operation. */
function buildSpec(): Spec {
  const paths: Spec['paths'] = {}
  const schemas: Record<string, unknown> = {}
  for (const id of Object.keys(GATEWAY_API_PAGES)) {
    schemas[`${id}Request`] = { type: 'object', properties: {} }
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

  test('gives description-only schemas an object shape so their Schema panel is not empty', () => {
    const source = buildSpec()
    const schemas = (source.components as { schemas: Record<string, unknown> }).schemas
    schemas.Passthrough = { description: 'Provider JSON forwarded unchanged.' }
    schemas.Status = { enum: ['ok'] }
    schemas.Labels = { additionalProperties: { type: 'string' } }
    schemas.Timestamp = { format: 'date-time' }
    const { spec } = transformSpec(source)
    const result = (spec.components as { schemas: Record<string, unknown> }).schemas
    expect(result.Passthrough).toEqual({
      description: 'Provider JSON forwarded unchanged.',
      type: 'object',
      additionalProperties: true,
    })
    expect(result.Status).toEqual({ enum: ['ok'] })
    expect(result.Labels).toEqual({ additionalProperties: { type: 'string' } })
    expect(result.Timestamp).toEqual({ format: 'date-time' })
  })

  test('folds error statuses identical to default into one default response', () => {
    const source = buildSpec()
    const error = { $ref: '#/components/responses/Error' }
    const rateLimited = { description: 'Rate limited.', headers: { 'Retry-After': { schema: { type: 'string' } } } }
    ;(source.paths['/v1/createVideo'].post as { responses: unknown }).responses = {
      '200': { description: 'OK' },
      '400': error,
      '429': rateLimited,
      '503': error,
      default: error,
    }
    ;(source.components as Record<string, unknown>).responses = {
      Error: { description: 'Gateway error.', content: { 'application/json': {} } },
    }
    const { spec } = transformSpec(source)
    expect((spec.paths['/v1/createVideo'].post as { responses: unknown }).responses).toEqual({
      '200': { description: 'OK' },
      '429': rateLimited,
      default: {
        description: 'Returned for 400, 503 and any other error status. Gateway error.',
        content: { 'application/json': {} },
      },
    })
    expect((source.components as { responses: { Error: { description: string } } }).responses.Error.description).toBe(
      'Gateway error.',
    )
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

describe('generate', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  // A dev server reloads once for every page that is rewritten, so an unchanged spec must leave the pages alone.
  test('keeps existing pages when nothing changed, and regenerates a missing page', { timeout: 120_000 }, async () => {
    vi.stubEnv('GATEWAY_OPENAPI_SPEC', path.join(DOCS_ROOT, 'scripts/gateway-api/openapi.snapshot.json'))
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const page = path.join(DOCS_ROOT, PAGES_DIR, 'list-models.api.mdx')

    await generate()
    const written = (await fs.stat(page)).mtimeMs

    await generate()
    expect((await fs.stat(page)).mtimeMs).toBe(written)
    expect(log).toHaveBeenLastCalledWith(expect.stringContaining('are up to date'))

    await fs.rm(page)
    await generate()
    expect(log).toHaveBeenLastCalledWith(expect.stringContaining('Generated'))
    await expect(fs.stat(page)).resolves.toBeDefined()
  })
})
