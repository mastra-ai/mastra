#!/usr/bin/env node
/**
 * Generates docs/src/content/en/reference/connect/providers.mdx from the
 * provider toolsets in src/providers, so the reference page always matches
 * the toolsets shipped by this package version.
 *
 * Runs as part of this package's `build` turbo task (see turbo.json), or
 * standalone:
 *
 *   pnpm --filter @mastra/connect generate:provider-docs
 *
 * Logos use the same sources as the docs integrations sidebar
 * (docs/src/content/en/integrations/sidebars.js): Simple Icons by slug,
 * with `src` overrides (svgl.app, or the platform catalog) for marks
 * Simple Icons lacks. `mono: true` marks single-color logos that the
 * ProviderLogo component tints for light/dark themes.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(packageDir, '../..');
const providersDir = join(packageDir, 'src/providers');
const outFile = join(repoRoot, 'docs/src/content/en/reference/connect/providers.mdx');

// Providers present in the package but not part of the documented release.
const EXCLUDE = new Set(['anthropic', 'google-analytics', 'microsoft-teams', 'stripe', 'twitter-v2']);

const DISPLAY: Record<string, string> = {
  clerk: 'Clerk',
  discord: 'Discord',
  fireflies: 'Fireflies.ai',
  github: 'GitHub',
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
};

type Logo = { slug?: string; src?: string; mono?: boolean };

const LOGOS: Record<string, Logo> = {
  clerk: { slug: 'clerk', mono: true },
  discord: { slug: 'discord' },
  fireflies: { src: 'https://app.nango.dev/images/template-logos/fireflies.svg' },
  github: { slug: 'github', mono: true },
  'google-calendar': { slug: 'googlecalendar' },
  'google-docs': { slug: 'googledocs' },
  'google-drive': { slug: 'googledrive' },
  'google-mail': { slug: 'gmail' },
  'google-sheet': { slug: 'googlesheets' },
  hubspot: { slug: 'hubspot' },
  'incident-io': { src: 'https://app.nango.dev/images/template-logos/incident-io.svg' },
  jira: { slug: 'jira' },
  linear: { slug: 'linear' },
  notion: { slug: 'notion', mono: true },
  openai: { src: 'https://svgl.app/library/openai.svg', mono: true },
  posthog: { slug: 'posthog' },
  resend: { slug: 'resend', mono: true },
  slack: { src: 'https://svgl.app/library/slack.svg' },
  snowflake: { slug: 'snowflake' },
  supabase: { slug: 'supabase' },
  workos: { src: 'https://svgl.app/library/workos.svg' },
};

function logoJsx(provider: string): string {
  const logo = LOGOS[provider];
  if (!logo) return '';
  const attrs = logo.src ? `src="${logo.src}"` : `slug="${logo.slug}"`;
  return `<ProviderLogo ${attrs}${logo.mono ? ' mono' : ''} /> `;
}

const providers = readdirSync(providersDir)
  .filter(p => {
    if (EXCLUDE.has(p)) return false;
    try {
      return statSync(join(providersDir, p, 'tools')).isDirectory();
    } catch {
      return false;
    }
  })
  .sort();

function extractTools(provider: string): Array<{ id: string; desc: string }> {
  const toolsDir = join(providersDir, provider, 'tools');
  const files = readdirSync(toolsDir).filter(f => f.endsWith('.ts'));
  const tools: Array<{ id: string; desc: string }> = [];
  for (const f of files) {
    const src = readFileSync(join(toolsDir, f), 'utf8');
    const idMatch = src.match(/id:\s*'([^']+)'/);
    const descMatch = src.match(
      /id:\s*'[^']+',\s*\n\s*description:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`)/,
    );
    if (!idMatch) {
      console.error(`WARN: no id in ${provider}/${f}`);
      continue;
    }
    let desc = descMatch ? (descMatch[1] ?? descMatch[2] ?? descMatch[3]) : '';
    desc = desc.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\s+/g, ' ').trim();
    // escape backslashes first, then pipes, for markdown tables
    desc = desc.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
    tools.push({ id: idMatch[1], desc });
  }
  tools.sort((a, b) => a.id.localeCompare(b.id));
  return tools;
}

let total = 0;
let out = '';
const tocRows: string[] = [];

for (const provider of providers) {
  const tools = extractTools(provider);
  total += tools.length;
  const name = DISPLAY[provider] ?? provider;
  // Default MDX heading slug (github-slugger style): lowercase, drop punctuation, spaces -> hyphens.
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/ /g, '-');
  tocRows.push(`| ${logoJsx(provider)}[${name}](#${slug}) | \`${provider}\` | ${tools.length} |`);
  out += `\n## ${name}\n\n`;
  out += `Provider ID: \`${provider}\` · ${tools.length} tools\n\n`;
  out += `| Tool | Description |\n| - | - |\n`;
  for (const t of tools) {
    out += `| \`${t.id}\` | ${t.desc || '—'} |\n`;
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

MCP providers (Attio, Canva, Clay, Neon, Render, Robinhood, and Sanity) serve their tools from their hosted MCP servers at runtime and aren't listed here. See [MCP providers](/docs/mastra-platform/connect/providers#mcp-providers) for the list and links to each provider's MCP documentation.

| Provider | Provider ID | Tools |
| - | - | - |
${tocRows.join('\n')}
`;

writeFileSync(outFile, header + out);
console.log(`Wrote providers.mdx: ${providers.length} providers, ${total} tools`);
