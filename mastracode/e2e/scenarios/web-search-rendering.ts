
import { z } from 'zod/v3';

import { expect } from './expect.js';

import type { McE2eScenario } from './types.js';

const webSearchTool = {
  id: 'web_search_20250305',
  description: 'E2E-only deterministic provider-style web search tool.',
  inputSchema: z.object({ query: z.string() }),
  execute: async (input: unknown) => {
    const query = input && typeof input === 'object' && 'query' in input ? String(input.query) : '';
    return JSON.stringify({
      action: { query },
      sources: [{ title: 'Mastra E2E Web Search Result', url: 'https://example.test/mastra-web-search' }],
      encryptedContent: 'SHOULD_NOT_RENDER_WEB_SEARCH_E2E',
    });
  },
};

export const webSearchRenderingScenario = {
  name: 'web-search-rendering',
  description: 'Render a deterministic provider-style web_search tool result through the real TUI.',
  testName: 'renders web search tool results without raw provider payloads',
  useOpenAIModel: true,
  aimockFixture: 'web-search-rendering.json',
  inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({
      config: {
        disableHooks: true,
        disableMcp: true,
        extraTools: { web_search_20250305: webSearchTool },
        unixSocketPubSub: false,
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as ReturnType<
      typeof expect
    >).toBeVisible();
    terminal.submit('Run the deterministic web search rendering e2e.');

    await runtime.waitForScreenText(/Mastra E2E Web Search Result/i, terminal, 10_000);
    await runtime.waitForScreenText(/https:\/\/example\.test\/mastra-web-search/i, terminal, 10_000);
    await runtime.waitForScreenText(/web_search\s+"Mastra e2e web search".*✓/i, terminal, 10_000);
    await runtime.waitForScreenText(/Web search rendering e2e complete\./i, terminal, 10_000);

    const screen = terminal.serialize().view;
    expect(screen).not.toContain('SHOULD_NOT_RENDER_WEB_SEARCH_E2E');

    terminal.keyCtrlC();
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
} satisfies McE2eScenario;
