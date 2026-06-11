import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect } from '@microsoft/tui-test';

import type { McE2eScenario } from './types.js';

export const webSearchRenderingScenario: McE2eScenario = {
  name: 'web-search-rendering',
  description: 'Render a deterministic provider-style web_search tool result through the real TUI.',
  testName: 'renders web search tool results without raw provider payloads',
  useOpenAIModel: true,
  aimockFixture: 'web-search-rendering.json',
  prepare({ mastracodeDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, '.mc-e2e-web-search-rendering-entrypoint.ts'),
      `import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const mastracodeDir = ${JSON.stringify(mastracodeDir)};
const { createMastraCode } = await import(pathToFileURL(join(mastracodeDir, 'src/index.ts')).href);
const { MastraTUI } = await import(pathToFileURL(join(mastracodeDir, 'src/tui/index.ts')).href);
const { getCurrentVersion } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/update-check.ts')).href);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

const webSearchTool = createTool({
  id: 'web_search_20250305',
  description: 'E2E-only deterministic provider-style web search tool.',
  inputSchema: z.object({ query: z.string() }),
  execute: async input => JSON.stringify({
    action: { query: input.query },
    sources: [
      { title: 'Mastra E2E Web Search Result', url: 'https://example.test/mastra-web-search' },
    ],
    encryptedContent: 'SHOULD_NOT_RENDER_WEB_SEARCH_E2E',
  }),
});

const result = await createMastraCode({
  cwd: process.cwd(),
  disableMcp: true,
  disableHooks: true,
  unixSocketPubSub: false,
  memory: false,
  extraTools: { web_search_20250305: webSearchTool },
});

const tui = new MastraTUI({
  harness: result.harness,
  hookManager: result.hookManager,
  authStorage: result.authStorage,
  mcpManager: result.mcpManager,
  appName: 'Mastra Code',
  version: getCurrentVersion(),
  inlineQuestions: true,
});

void tui.run().catch(error => {
  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\\n');
  process.exit(1);
});
`,
    );
  },
  entrypoint({ projectDir }) {
    return join(projectDir, '.mc-e2e-web-search-rendering-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
    terminal.submit('Run the deterministic web search rendering e2e.');

    await runtime.waitForScreenText(/Mastra E2E Web Search Result/i, terminal, 10_000);
    await runtime.waitForScreenText(/https:\/\/example\.test\/mastra-web-search/i, terminal, 10_000);
    await runtime.waitForScreenText(/web_search\s+"Mastra e2e web search".*✓/i, terminal, 10_000);
    await runtime.waitForScreenText(/Web search rendering e2e complete\./i, terminal, 10_000);

    const screen = terminal.serialize().view;
    expect(screen).not.toContain('SHOULD_NOT_RENDER_WEB_SEARCH_E2E');

    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 2) {
      throw new Error(`Expected web search rendering scenario to make 2 AIMock requests, received ${requests.length}`);
    }
    const serialized = JSON.stringify(requests);
    if (!serialized.includes('call_web_search_rendering_e2e') || !serialized.includes('web_search_20250305')) {
      throw new Error('Expected AIMock flow to include the web_search tool call.');
    }
    if (!serialized.includes('Mastra E2E Web Search Result')) {
      throw new Error('Expected follow-up request to include the web_search tool result.');
    }
  },
};
