import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MastraGateway } from '../../../../llm/model/gateways/mastra';
import { ModelRouterLanguageModel } from '../../../../llm/model/router';
import { createTool, webSearchTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Web search on models served through the Mastra gateway.
 *
 * The gateway's chat endpoint only runs `openrouter:*` server tools. The built-in webSearchTool
 * resolved to the model provider's native tool (`openai.web_search`, ...), which the gateway
 * rejected with a 400 for OpenAI models and dropped without an error for Anthropic and Google
 * models, so the agent either failed every turn or lost web search.
 */

const OPENAI_MODEL = 'mastra/openai/gpt-6.1-sol';

const lanes = [
  { provider: 'OpenAI', model: OPENAI_MODEL },
  { provider: 'Anthropic', model: 'mastra/anthropic/claude-sonnet-5-5' },
  { provider: 'Google', model: 'mastra/google/gemini-3.8-flash' },
] as const;

const providerTool = (id: string, args: Record<string, unknown> = {}) => ({
  type: 'provider-defined',
  id,
  name: id.slice(id.indexOf('.') + 1),
  args,
});

describeForAllEngines('AIMock loop scenario: web search through the Mastra gateway', engine => {
  const getMock = useLoopScenarioAimock();

  // Recorded at the wire because the tool type on the request is the contract with the gateway.
  let sentBodies: any[] = [];
  const recordingFetch = async (input: any, init?: any) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith(getMock().url) && typeof init?.body === 'string') sentBodies.push(JSON.parse(init.body));
    return realFetch(input, init);
  };
  let realFetch: typeof globalThis.fetch;
  beforeEach(() => {
    sentBodies = [];
    realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(recordingFetch);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const gatewayModel =
    (id: string, config: { customFetch?: typeof globalThis.fetch } = {}) =>
    () =>
      new ModelRouterLanguageModel(id as `${string}/${string}`, [
        new MastraGateway({ apiKey: 'test-key', baseUrl: getMock().url, ...config }),
      ]);

  const sentToolTypes = () => (sentBodies[0]?.tools ?? []).map((tool: { type: string }) => tool.type);

  async function runWithTools(model: () => any, tools: Record<string, unknown>) {
    const errors: string[] = [];
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What is the weather in London?',
      model,
      tools: tools as any,
      onError: ({ error }) => {
        errors.push(typeof error === 'string' ? error : error.message);
      },
      fixtures: llm => {
        llm.on({}, { content: 'Mostly clear, 4°C.' });
      },
    });
    return { text: await output.text, finishReason: await output.finishReason, errors: errors.join('\n') };
  }

  for (const lane of lanes) {
    it(`an agent with webSearchTool on a gateway ${lane.provider} model asks the gateway for its web search`, async () => {
      const { text } = await runWithTools(gatewayModel(lane.model), { web_search: webSearchTool });

      expect(text).toBe('Mostly clear, 4°C.');
      expect(sentToolTypes()).toEqual(['openrouter:web_search']);
    });
  }

  it('web search is swapped without disturbing function tools or an explicit gateway search tool', async () => {
    const lookup = createTool({
      id: 'lookup',
      description: 'Look up a value.',
      inputSchema: z.object({ key: z.string() }),
      execute: async () => ({ value: 'x' }),
    });

    await runWithTools(gatewayModel(OPENAI_MODEL), { lookup, web_search: webSearchTool });
    expect(sentToolTypes().sort()).toEqual(['function', 'openrouter:web_search']);

    sentBodies = [];
    await runWithTools(gatewayModel(OPENAI_MODEL), { search: providerTool('openrouter.web_search') });
    expect(sentToolTypes()).toEqual(['openrouter:web_search']);
  });

  it('a generate call through the gateway model sends the gateway web search', async () => {
    getMock().on({}, { content: 'Mostly clear, 4°C.' });

    await gatewayModel(OPENAI_MODEL)().doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'What is the weather in London?' }] }],
      tools: [providerTool('openai.web_search')],
    } as any);

    expect(sentToolTypes()).toEqual(['openrouter:web_search']);
  });

  it('the OAuth Anthropic route keeps the native Anthropic web search', async () => {
    // This route calls the Anthropic Messages API, which runs the native tool itself.
    const { text } = await runWithTools(gatewayModel(lanes[1].model, { customFetch: recordingFetch as any }), {
      web_search: webSearchTool,
    });

    expect(text).toBe('Mostly clear, 4°C.');
    expect(sentToolTypes()).toEqual(['web_search_20250305']);
  });

  it('a native provider tool the gateway cannot run fails with a message naming the tool', async () => {
    const { finishReason, errors } = await runWithTools(gatewayModel(OPENAI_MODEL), {
      code_interpreter: providerTool('openai.code_interpreter'),
    });

    expect(finishReason).toBe('error');
    expect(errors).toContain(`"openai.code_interpreter" cannot be used with "${OPENAI_MODEL}"`);
    expect(errors).toContain('Call the provider directly to use this tool.');
    // Nothing is sent, so the model cannot answer as if the tool were available.
    expect(sentBodies).toHaveLength(0);
  });

  it('a native web search tool with provider options fails instead of losing the options', async () => {
    const { finishReason, errors } = await runWithTools(gatewayModel(OPENAI_MODEL), {
      web_search: providerTool('openai.web_search', { searchContextSize: 'high' }),
    });

    expect(finishReason).toBe('error');
    expect(errors).toContain('does not accept "openai.web_search" options');
    expect(sentBodies).toHaveLength(0);
  });
});
