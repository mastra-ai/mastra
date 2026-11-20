import fs from 'fs'
import path from 'path'
import { createApiPageMD } from 'docusaurus-plugin-openapi-docs/lib/markdown'
import type { ApiPageMetadata } from 'docusaurus-plugin-openapi-docs/src/types'
import { DOCS_ROOT, PAGES_DIR, SPEC_URL } from './constants'
import { GATEWAY_API_PAGES } from './pages'
import type { GatewayApiPage } from './pages'

const GUIDE_SLOT = 'GATEWAYAPIGUIDESLOT'

/** Frontmatter for a generated page. Values are JSON strings, which are valid YAML scalars. */
function frontMatter(fields: Record<string, string | undefined>): string {
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n')
}

/**
 * Wraps the plugin's API page generator. Applies the title, description, and slug from `pages.ts`, and
 * renders an AI-agent note pointing to the OpenAPI spec, then the operation's hand-written guide if there is
 * one, between the endpoint and the generated description, request, and response reference.
 *
 * The template in `template.mustache` writes `gatewayFrontMatter` into the page's frontmatter.
 */
export function createGatewayApiPageMD(item: ApiPageMetadata & { gatewayFrontMatter?: string }): string {
  const operationId = item.api.operationId
  const page = operationId ? GATEWAY_API_PAGES[operationId] : undefined
  const title = page?.title ?? item.title
  const description = page?.description ?? item.frontMatter.description

  item.title = title
  item.gatewayFrontMatter = frontMatter({
    title: `${title} | Gateway`,
    description,
    slug: page ? `/${path.posix.join(PAGES_DIR.replace(/^src\/content\/en\/docs\//, ''), page.slug)}` : undefined,
  })

  const guide = page && path.posix.join('_guides', `${page.slug}.mdx`)
  const hasGuide = guide !== undefined && fs.existsSync(path.join(DOCS_ROOT, PAGES_DIR, guide))

  // The plugin escapes MDX in descriptions, so render a plain-text slot there and swap the MDX in after.
  const markdown = createApiPageMD({
    ...item,
    title,
    api: { ...item.api, description: `${GUIDE_SLOT}\n\n${item.api.description ?? ''}` },
  })
  if (!markdown.includes(GUIDE_SLOT)) throw new Error(`Could not place the guide for ${operationId}`)
  const slot = [agentNote(page?.compatibleWith), hasGuide ? '<Guide />' : undefined].filter(Boolean).join('\n\n')
  const body = markdown.replace(GUIDE_SLOT, slot)
  return hasGuide ? `import Guide from './${guide}'\n${body}` : body
}

function agentNote(compatibleWith: GatewayApiPage['compatibleWith']): string {
  const compatibility = compatibleWith
    ? ` Some fields, such as streaming event payloads, are open objects in the spec. Check those against the [${compatibleWith.name}](${compatibleWith.url}), which this endpoint is compatible with.`
    : ''
  return `<Inject>\n  **For AI agents:** Gateway publishes a public OpenAPI spec for every endpoint at [${SPEC_URL}](${SPEC_URL}). Use it for request and response schemas.${compatibility}\n</Inject>`
}
