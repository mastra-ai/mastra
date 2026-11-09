import { expect } from './expect.js';

import type { McE2eScenario } from './types.js';

type AimockRequest = { path?: string; body?: { model?: string; tools?: Array<{ type?: string }> } };

export const gatewayWebSearchScenario = {
  name: 'gateway-web-search',
  description:
    'Select a mastra/ gateway alias with a gateway key and verify the request carries the gateway web search tool.',
  testName: 'sends gateway web search for a mastra/ model alias and renders the reply',
  useOpenAIModel: true,
  aimockFixture: 'gateway-web-search.json',
  env({ aimockUrl }) {
    if (!aimockUrl) throw new Error('gateway-web-search needs the AIMock URL');
    return {
      MASTRACODE_MODEL_ID: 'mastra/openai/gpt-5.4-mini',
      MASTRA_GATEWAY_API_KEY: 'mc-e2e-gateway-key',
      // A configured Parallel or Tavily backend would replace provider search.
      PARALLEL_API_KEY: null,
      TAVILY_API_KEY: null,
      // The gateway client appends /v1, so this routes OpenRouter chat requests to AIMock.
      MASTRA_GATEWAY_URL: aimockUrl,
    };
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await (
      expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as ReturnType<
        typeof expect
      >
    ).toBeVisible();
    terminal.submit('Search the web through the Mastra gateway.');

    await runtime.waitForScreenText(/Gateway web search found the Mastra release notes/i, terminal, 15_000);
    await runtime.waitForScreenText(/https:\/\/example\.test\/mastra-gateway-search/i, terminal, 10_000);

    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const chat = (requests as AimockRequest[]).filter(request => request.body?.model === 'openai/gpt-5.4-mini');
    if (chat.length === 0) {
      throw new Error(`Expected a gateway chat request for openai/gpt-5.4-mini, received ${JSON.stringify(requests)}`);
    }
    const toolTypes = chat.flatMap(request => request.body?.tools ?? []).map(tool => tool.type);
    if (!toolTypes.includes('openrouter:web_search')) {
      throw new Error(
        `Expected the gateway request to include openrouter:web_search, received ${toolTypes.join(', ')}`,
      );
    }
    if (toolTypes.some(type => type === 'openai:web_search' || type?.startsWith('anthropic:web_search'))) {
      throw new Error(`Expected no native provider search tool on the gateway route, received ${toolTypes.join(', ')}`);
    }
  },
} satisfies McE2eScenario;
