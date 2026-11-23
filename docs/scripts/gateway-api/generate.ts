import { execFile } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { promisify } from 'util'
import { isDirectRun } from '../is-direct-run'
import { API_HOST, DOCS_ROOT, PAGES_DIR, PLUGIN_ID, SPEC_OUTPUT, SPEC_URL } from './constants'
import { GATEWAY_API_PAGES } from './pages'

/**
 * Generates the Gateway API reference pages from the live OpenAPI document.
 *
 * 1. Fetches the spec (override with GATEWAY_OPENAPI_SPEC, a URL or a local file path).
 *    If the fetch fails, it falls back to `openapi.snapshot.json`. Refresh the snapshot (from `docs/`) with:
 *    curl -fsS https://gateway-api.mastra.ai/openapi.json -o /tmp/gateway-openapi.json \
 *      && node -e "if (!JSON.parse(require('fs').readFileSync('/tmp/gateway-openapi.json', 'utf8')).paths) process.exit(1)" \
 *      && mv /tmp/gateway-openapi.json scripts/gateway-api/openapi.snapshot.json
 * 2. Drops infrastructure operations and points `servers` at the public API host.
 * 3. Runs the `docusaurus-plugin-openapi-docs` CLI, which writes one `*.api.mdx` page per operation.
 *    `markdown.ts` gives each page its slug, title, and guide from `pages.ts`.
 *
 * Generated files are gitignored. `pnpm build`, `pnpm dev`, and `pnpm check` run this first.
 *
 * Usage:
 *   pnpm generate:gateway-api
 */

const execFileAsync = promisify(execFile)

/** Used when the live spec can't be fetched. */
const SNAPSHOT_PATH = path.join(DOCS_ROOT, 'scripts/gateway-api/openapi.snapshot.json')

/** Operations that don't belong in the API reference. */
const EXCLUDED_OPERATIONS = new Set(['getOpenApi', 'getHealth', 'getReadiness'])

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']

const SCHEMA_ANNOTATION_KEYS = new Set([
  'description',
  'title',
  'example',
  'examples',
  'deprecated',
  'externalDocs',
  'readOnly',
  'writeOnly',
])

type Operation = { operationId?: string; [key: string]: unknown }
interface OpenApiDocument {
  openapi: string
  servers?: { url: string; description?: string }[]
  paths: Record<string, Record<string, Operation | unknown>>
  [key: string]: unknown
}

export async function loadSpec(source = process.env.GATEWAY_OPENAPI_SPEC ?? SPEC_URL): Promise<OpenApiDocument> {
  if (!/^https?:\/\//.test(source)) {
    return JSON.parse(await fs.readFile(path.resolve(source), 'utf-8')) as OpenApiDocument
  }
  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(source, { signal: AbortSignal.timeout(15_000) })
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
      return (await response.json()) as OpenApiDocument
    } catch (error) {
      lastError = error
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 2000))
    }
  }
  // Slightly stale reference pages are better than a failed docs build or deploy.
  console.warn(
    `[gateway-api] Could not fetch the Gateway OpenAPI document from ${source} (${String(lastError)}). Using ${SNAPSHOT_PATH}.`,
  )
  return JSON.parse(await fs.readFile(SNAPSHOT_PATH, 'utf-8')) as OpenApiDocument
}

export interface TransformResult {
  spec: OpenApiDocument
  /** Operations kept that have no entry in GATEWAY_API_PAGES. */
  unmapped: string[]
}

/**
 * The spec lists every error status separately, mostly pointing at the same shared error response, so the
 * page showed a row of status tabs that all looked the same. Statuses whose response is identical to `default`
 * are folded into it, and its description lists them. Statuses with their own shape (such as 429 and its
 * rate-limit headers) keep their own tab.
 */
function mergeDefaultResponses(spec: OpenApiDocument, operation: Operation) {
  const responses = operation.responses as Record<string, Record<string, unknown>> | undefined
  if (!responses?.default) return
  const fallback = JSON.stringify(responses.default)
  const merged = Object.keys(responses).filter(
    status => status !== 'default' && !status.startsWith('2') && JSON.stringify(responses[status]) === fallback,
  )
  if (merged.length === 0) return
  const response = structuredClone(resolveResponse(spec, responses.default))
  response.description =
    `Returned for ${merged.join(', ')} and any other error status. ${response.description ?? ''}`.trim()
  for (const status of merged) delete responses[status]
  responses.default = response
}

function resolveResponse(spec: OpenApiDocument, response: Record<string, unknown>): Record<string, unknown> {
  if (typeof response.$ref !== 'string') return response
  const name = response.$ref.replace('#/components/responses/', '')
  const resolved = (spec.components as { responses?: Record<string, Record<string, unknown>> } | undefined)
    ?.responses?.[name]
  if (!resolved) throw new Error(`Response ${response.$ref} is not in components.responses`)
  return resolved
}

export function transformSpec(source: OpenApiDocument): TransformResult {
  const spec = structuredClone(source)
  const unmapped: string[] = []
  const missing = new Set(Object.keys(GATEWAY_API_PAGES))

  for (const [route, pathItem] of Object.entries(spec.paths)) {
    for (const method of Object.keys(pathItem)) {
      if (!HTTP_METHODS.includes(method)) continue
      const id = (pathItem[method] as Operation).operationId
      if (!id) throw new Error(`${method.toUpperCase()} ${route} has no operationId`)
      if (EXCLUDED_OPERATIONS.has(id)) {
        delete pathItem[method]
        continue
      }
      if (!missing.delete(id)) unmapped.push(id)
      mergeDefaultResponses(spec, pathItem[method] as Operation)
    }
    if (!Object.keys(pathItem).some(key => HTTP_METHODS.includes(key))) delete spec.paths[route]
  }

  // A page listed in sidebars.js would point at a doc that no longer exists.
  if (missing.size > 0) {
    throw new Error(
      `The Gateway OpenAPI document no longer has ${[...missing].join(', ')}. Remove them from pages.ts and sidebars.js.`,
    )
  }

  // A schema with only annotations, such as a description (provider JSON passed through) renders as an empty Schema panel.
  const components = spec.components as { schemas?: Record<string, Record<string, unknown>> } | undefined
  for (const schema of Object.values(components?.schemas ?? {})) {
    if (Object.keys(schema).every(key => SCHEMA_ANNOTATION_KEYS.has(key))) {
      schema.type = 'object'
      schema.additionalProperties = true
    }
  }

  // The spec uses a relative server URL, which would resolve against the docs site.
  spec.servers = [{ url: API_HOST, description: 'Mastra Gateway' }]
  return { spec, unmapped }
}

async function runPluginCli(command: 'gen-api-docs' | 'clean-api-docs'): Promise<string> {
  const { stdout, stderr } = await execFileAsync('pnpm', ['exec', 'docusaurus', command, PLUGIN_ID], {
    cwd: DOCS_ROOT,
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  })
  return `${stdout}${stderr}`
}

export async function generate(): Promise<void> {
  const { spec, unmapped } = transformSpec(await loadSpec())
  for (const id of unmapped) {
    console.warn(
      `[gateway-api] ${id} has no entry in pages.ts. Its page is generated from the spec summary; add it to pages.ts and sidebars.js.`,
    )
  }

  const specPath = path.join(DOCS_ROOT, SPEC_OUTPUT)
  await fs.mkdir(path.dirname(specPath), { recursive: true })
  await fs.writeFile(specPath, `${JSON.stringify(spec, null, 2)}\n`)

  // Like generation, cleanup logs failures instead of exiting non-zero, and the plugin skips pages that already exist.
  const cleanup = await runPluginCli('clean-api-docs')
  if (/Cleanup failed/.test(cleanup)) throw new Error(`clean-api-docs reported failures:\n${cleanup}`)
  const output = await runPluginCli('gen-api-docs')

  // The plugin logs write failures instead of exiting non-zero, so check its output and the files it wrote.
  if (/Failed to (write|create)/.test(output)) throw new Error(`gen-api-docs reported failures:\n${output}`)
  const pagesDir = path.join(DOCS_ROOT, PAGES_DIR)
  // The plugin always writes an overview page for the spec's `info`; the hand-written overview covers it.
  for (const file of await fs.readdir(pagesDir)) {
    if (file.endsWith('.info.mdx')) await fs.unlink(path.join(pagesDir, file))
  }
  const pages = (await fs.readdir(pagesDir)).filter(file => file.endsWith('.api.mdx'))
  const operationCount = Object.values(spec.paths).reduce(
    (count, pathItem) => count + Object.keys(pathItem).filter(key => HTTP_METHODS.includes(key)).length,
    0,
  )
  if (pages.length !== operationCount) {
    throw new Error(`Expected ${operationCount} generated pages in ${PAGES_DIR}, found ${pages.length}`)
  }
  console.log(`[gateway-api] Generated ${pages.length} pages in ${PAGES_DIR}`)
}

if (isDirectRun(import.meta.url)) {
  generate().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
