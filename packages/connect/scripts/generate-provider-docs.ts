#!/usr/bin/env node
/**
 * Generates Connect provider documentation from the provider toolsets in
 * src/providers and the curated metadata in provider-docs-metadata.ts:
 *
 * - docs/src/content/en/reference/connect/providers.mdx (every published toolset)
 * - full integration pages for providers with `ownership: 'generated-page'` and `emit: true`
 * - partials in docs/src/components/connect/generated/ for handwritten pages
 *
 * After writing, it formats exactly the files it emitted with the docs MDX
 * formatter (oxfmt-mdx). Runs as part of this package's `build` turbo task (see
 * turbo.json), or standalone:
 *
 *   pnpm --filter @mastra/connect generate:provider-docs
 *
 * See scripts/README.md for ownership rules.
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractTools, listToolProviders, planOutputs, writeOutputs } from './provider-docs-lib.js';
import type { Tool } from './provider-docs-lib.js';
import { CONNECT_GUIDE_PATH, EXCLUDED_PROVIDERS, MCP_PROVIDERS, TOOL_PROVIDERS } from './provider-docs-metadata.js';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = join(packageDir, '../../docs');
const providersDir = join(packageDir, 'src/providers');

const providers = listToolProviders(providersDir, EXCLUDED_PROVIDERS);
const toolsByProvider: Record<string, Tool[]> = {};
for (const provider of providers) toolsByProvider[provider] = extractTools(providersDir, provider);

const outputs = planOutputs(providers, toolsByProvider, {
  connectGuidePath: CONNECT_GUIDE_PATH,
  toolProviders: TOOL_PROVIDERS,
  mcpProviders: MCP_PROVIDERS,
});
const written = writeOutputs(docsRoot, outputs);

execFileSync('pnpm', ['exec', 'oxfmt-mdx', '--write', ...written], { cwd: docsRoot, stdio: 'inherit' });

const total = Object.values(toolsByProvider).reduce((n, tools) => n + tools.length, 0);
console.log(`Wrote ${written.length} files (${providers.length} providers, ${total} tools):`);
for (const path of written) console.log(`  docs/${path}`);
