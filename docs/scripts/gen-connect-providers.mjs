/**
 * Generates docs/src/content/en/reference/connect/providers.mdx from the
 * provider toolsets in packages/connect/src/providers.
 *
 * Run from the repo root after adding or syncing a connect provider:
 *
 *   node docs/scripts/gen-connect-providers.mjs .
 *
 * Logos are sourced from theSVG (the same source the platform dashboard
 * uses). LOGOS maps each provider ID to its theSVG slug; `mono: true`
 * marks single-color marks that the ProviderLogo component tints for
 * light/dark themes, and `src` overrides the URL for providers theSVG
 * lacks.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2]
const providersDir = join(root, 'packages/connect/src/providers')

// Providers present in the package but not part of the documented release.
const EXCLUDE = new Set(['anthropic', 'microsoft-teams', 'stripe', 'twitter-v2'])

const DISPLAY = {
  clerk: 'Clerk',
  discord: 'Discord',
  fireflies: 'Fireflies.ai',
  github: 'GitHub',
  'google-analytics': 'Google Analytics',
  'google-calendar': 'Google Calendar',
  'google-docs': 'Google Docs',
  'google-drive': 'Google Drive',
  'google-mail': 'Gmail',
  'google-sheet': 'Google Sheets',
  hubspot: 'HubSpot',
  'incident-io': 'incident.io',
  jira: 'Jira',
  linear: 'Linear',
  notion: 'Notion',
  openai: 'OpenAI',
  posthog: 'PostHog',
  resend: 'Resend',
  slack: 'Slack',
  snowflake: 'Snowflake',
  supabase: 'Supabase',
  workos: 'WorkOS',
}

const LOGOS = {
  clerk: { slug: 'clerk', mono: true },
  discord: { slug: 'discord' },
  fireflies: { src: 'https://app.nango.dev/images/template-logos/fireflies.svg' },
  github: { slug: 'github', mono: true },
  'google-analytics': { slug: 'google-analytics' },
  'google-calendar': { slug: 'google-calendar' },
  'google-docs': { slug: 'google-docs' },
  'google-drive': { slug: 'google-drive' },
  'google-mail': { slug: 'gmail' },
  'google-sheet': { slug: 'google-sheets' },
  hubspot: { slug: 'hubspot' },
  'incident-io': { slug: 'incident' },
  jira: { slug: 'jira' },
  linear: { slug: 'linear' },
  notion: { slug: 'notion', mono: true },
  openai: { slug: 'openai', mono: true },
  posthog: { slug: 'posthog' },
  resend: { slug: 'resend', mono: true },
  slack: { slug: 'slack' },
  snowflake: { slug: 'snowflake' },
  supabase: { slug: 'supabase' },
  workos: { slug: 'workos', mono: true },
}

export function logoJsx(provider) {
  const logo = LOGOS[provider]
  if (!logo) return ''
  const attrs = logo.src ? `src="${logo.src}"` : `slug="${logo.slug}"`
  return `<ProviderLogo ${attrs}${logo.mono ? ' mono' : ''} /> `
}

const providers = readdirSync(providersDir)
  .filter(p => {
    if (EXCLUDE.has(p)) return false
    try {
      return statSync(join(providersDir, p, 'tools')).isDirectory()
    } catch {
      return false
    }
  })
  .sort()

function extractTools(provider) {
  const toolsDir = join(providersDir, provider, 'tools')
  const files = readdirSync(toolsDir).filter(f => f.endsWith('.ts'))
  const tools = []
  for (const f of files) {
    const src = readFileSync(join(toolsDir, f), 'utf8')
    const idMatch = src.match(/id:\s*'([^']+)'/)
    const descMatch = src.match(
      /id:\s*'[^']+',\s*\n\s*description:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`)/,
    )
    if (!idMatch) {
      console.error(`WARN: no id in ${provider}/${f}`)
      continue
    }
    let desc = descMatch ? (descMatch[1] ?? descMatch[2] ?? descMatch[3]) : ''
    desc = desc.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\s+/g, ' ').trim()
    // escape pipes for markdown tables
    desc = desc.replace(/\|/g, '\\|')
    tools.push({ id: idMatch[1], desc })
  }
  tools.sort((a, b) => a.id.localeCompare(b.id))
  return tools
}

let total = 0
let out = ''
const tocRows = []

for (const provider of providers) {
  const tools = extractTools(provider)
  total += tools.length
  const name = DISPLAY[provider] ?? provider
  // Default MDX heading slug (github-slugger style): lowercase, drop punctuation, spaces -> hyphens.
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/ /g, '-')
  tocRows.push(`| ${logoJsx(provider)}[${name}](#${slug}) | \`${provider}\` | ${tools.length} |`)
  out += `\n## ${name}\n\n`
  out += `Provider ID: \`${provider}\` · ${tools.length} tools\n\n`
  out += `| Tool | Description |\n| - | - |\n`
  for (const t of tools) {
    out += `| \`${t.id}\` | ${t.desc || '—'} |\n`
  }
}

const header = `---
title: "Reference: Provider toolsets | Connect"
description: "Every generated provider toolset included in @mastra/connect: provider IDs and the full tool list per provider."
packages:
  - "@mastra/connect"
---

import { ProviderLogo } from '@site/src/components/connect/provider-logo';

# Provider toolsets

\`@mastra/connect\` includes generated toolsets for ${providers.length} providers (${total} tools in this version). [\`tools()\`](/reference/connect/tools) exposes a provider's toolset when the project has an active connection for its provider ID.

Tool keys are stable identifiers of the form \`<provider>_<action>\` and are the values accepted by \`allowTools\` and \`disallowTools\`. Toolsets are versioned with the package: the exact list depends on the installed \`@mastra/connect\` version, and this page reflects the version it was generated from.

MCP providers (Airtable, Attio, Canva, Clay, Granola, Neon, Render, Robinhood, and Sanity) serve their tools from their hosted MCP servers at runtime and aren't listed here. See [MCP providers](/docs/mastra-platform/connect/providers#mcp-providers) for the list and links to each provider's MCP documentation.

| Provider | Provider ID | Tools |
| - | - | - |
${tocRows.join('\n')}
`

writeFileSync(join(root, 'docs/src/content/en/reference/connect/providers.mdx'), header + out)
console.log(`Wrote providers.mdx: ${providers.length} providers, ${total} tools`)
