import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createGlobalPatchScope } from './global-patches.js';
import type { McE2eScenario, McE2eScenarioRuntime, McE2eTerminal } from './types.js';

const effort = (...values: string[]) => [{ type: 'effort', values }];

// Keep model discovery independent of external catalogs while exercising its real HTTP boundary.
const modelCatalog = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    npm: '@ai-sdk/anthropic',
    env: ['ANTHROPIC_API_KEY'],
    models: { 'claude-haiku-4-5': { id: 'claude-haiku-4-5' } },
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    npm: '@ai-sdk/openai',
    env: ['OPENAI_API_KEY'],
    models: { 'gpt-4o': { id: 'gpt-4o' } },
  },
  xai: {
    id: 'xai',
    name: 'xAI',
    npm: '@ai-sdk/xai',
    env: ['XAI_API_KEY'],
    models: {
      'grok-4.6': { id: 'grok-4.6', reasoning_options: effort('low', 'medium', 'high', 'xhigh') },
      'grok-4.5': { id: 'grok-4.5', reasoning_options: effort('low', 'medium', 'high', 'xhigh') },
      'grok-4.20-0309-reasoning': { id: 'grok-4.20-0309-reasoning' },
    },
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral',
    npm: '@ai-sdk/mistral',
    env: ['MISTRAL_API_KEY'],
    models: {
      'zai-glm-5-2': { id: 'zai-glm-5-2', reasoning_options: effort('none', 'high', 'max') },
      'zai-glm-5-3': { id: 'zai-glm-5-3', reasoning_options: effort('low', 'high', 'max') },
    },
  },
  'perplexity-agent': {
    id: 'perplexity-agent',
    name: 'Perplexity Agent',
    npm: '@ai-sdk/perplexity',
    env: ['PERPLEXITY_API_KEY'],
    models: {
      'openai/gpt-5.5': { id: 'openai/gpt-5.5', reasoning_options: effort('low', 'medium', 'high', 'xhigh', 'max') },
    },
  },
};

async function openThinkPicker(terminal: McE2eTerminal, runtime: McE2eScenarioRuntime): Promise<string> {
  terminal.submit('/think');
  await runtime.waitForScreenText(/Session override.*inherits mode\/global defaults/i, terminal, 8_000);
  await runtime.waitForScreenText(/Reasoning disabled/i, terminal, 8_000);
  return terminal.serialize().view;
}

async function closeThinkPicker(terminal: McE2eTerminal, runtime: McE2eScenarioRuntime): Promise<void> {
  terminal.write('\x1b');
  await runtime.waitForScreenTextAbsent(/Session override.*inherits mode\/global defaults/i, terminal, 8_000);
}

async function switchModel(
  terminal: McE2eTerminal,
  runtime: McE2eScenarioRuntime,
  provider: string,
  model: string,
): Promise<void> {
  const escapedModel = model.replaceAll('.', '\\.');
  terminal.submit('/model');
  await runtime.waitForScreenText(/Type to search/i, terminal, 8_000);
  terminal.write(`${provider}/${model}`);
  await runtime.waitForScreenText(new RegExp(`${provider}/${escapedModel}`, 'i'), terminal, 8_000);
  terminal.write('\r');
  await runtime.waitForScreenText(new RegExp(`\\bbuild · (?:${provider}/)?${escapedModel} · `), terminal, 8_000);
}

export const thinkPickerPerModelScenario = {
  name: 'think-picker-per-model',
  description: 'Offers only the thinking levels the selected model runs in /think, and updates them on a model switch.',
  testName: 'offers the thinking levels each Claude, OpenAI, Grok, Mistral and Perplexity model can send',
  env: () => ({
    MASTRACODE_MODEL_ID: 'anthropic/claude-haiku-4-5',
    ANTHROPIC_API_KEY: 'mc-e2e-anthropic-key',
    OPENAI_API_KEY: 'mc-e2e-openai-key',
    XAI_API_KEY: 'mc-e2e-xai-key',
    MISTRAL_API_KEY: 'mc-e2e-mistral-key',
    PERPLEXITY_API_KEY: 'mc-e2e-perplexity-key',
  }),
  async inProcessApp({ startMastraCodeApp }) {
    const server = createServer((request, response) => {
      response.setHeader('content-type', 'application/json');
      if (request.url === '/models.dev/api.json') response.end(JSON.stringify(modelCatalog));
      else if (request.url === '/netlify/providers') response.end(JSON.stringify({ providers: {} }));
      else {
        response.statusCode = 404;
        response.end(JSON.stringify({ error: 'Unknown catalog fixture' }));
      }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address !== 'string');
    const fixtureURL = `http://127.0.0.1:${address.port}`;
    const routes = new Map([
      ['https://models.dev/api.json', '/models.dev/api.json'],
      ['https://api.netlify.com/api/v1/ai-gateway/providers', '/netlify/providers'],
    ]);
    let stopping: Promise<void> | undefined;
    const stopCatalog = () =>
      (stopping ??= new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }));
    const patches = createGlobalPatchScope();
    const originalFetch = globalThis.fetch.bind(globalThis);
    patches.setProperty(globalThis, 'fetch', (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const route = routes.get(url);
      return originalFetch(route ? `${fixtureURL}${route}` : input, init);
    });
    try {
      const app = await startMastraCodeApp();
      return {
        async stop() {
          try {
            await patches.stopApp(app.stop);
          } finally {
            await stopCatalog();
          }
        },
      };
    } catch (error) {
      patches.restore();
      await stopCatalog();
      throw error;
    }
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    await runtime.waitForScreenText(/\bbuild · (?:anthropic\/)?claude-haiku-4-5 · /i, terminal, 8_000);

    terminal.submit('/think max');
    await runtime.waitForScreenText(
      /Invalid thinking level: max\. Use one of: off, low, medium, high, xhigh,/i,
      terminal,
    );

    const haikuPicker = await openThinkPicker(terminal, runtime);
    runtime.printScreen('/think on Claude Haiku 4.5', terminal);
    assert.match(haikuPicker, /Very High\s+Maximum reasoning depth/);
    assert.doesNotMatch(haikuPicker, /Unbounded reasoning/);
    await closeThinkPicker(terminal, runtime);

    await switchModel(terminal, runtime, 'openai', 'gpt-4o');

    const gpt4oPicker = await openThinkPicker(terminal, runtime);
    runtime.printScreen('/think on GPT-4o', terminal);
    assert.match(gpt4oPicker, /none\s+Reasoning disabled/);
    assert.doesNotMatch(gpt4oPicker, /Light reasoning|Balanced reasoning|Deep reasoning/);
    await closeThinkPicker(terminal, runtime);

    await switchModel(terminal, runtime, 'xai', 'grok-4.6');
    const grok46Picker = await openThinkPicker(terminal, runtime);
    runtime.printScreen('/think on Grok 4.6', terminal);
    assert.match(grok46Picker, /Very High\s+Maximum reasoning depth/);
    await closeThinkPicker(terminal, runtime);

    await switchModel(terminal, runtime, 'xai', 'grok-4.5');
    const grok45Picker = await openThinkPicker(terminal, runtime);
    runtime.printScreen('/think on Grok 4.5', terminal);
    assert.match(grok45Picker, /Very High\s+Maximum reasoning depth/);
    await closeThinkPicker(terminal, runtime);

    await switchModel(terminal, runtime, 'xai', 'grok-4.20-0309-reasoning');
    const grok420Picker = await openThinkPicker(terminal, runtime);
    runtime.printScreen('/think on Grok 4.20 without reasoning controls', terminal);
    // Only OpenAI models show the provider value ("none"); other providers label it "Off".
    assert.match(grok420Picker, /Off\s+Reasoning disabled/);
    assert.doesNotMatch(grok420Picker, /Light reasoning|Balanced reasoning|Deep reasoning|Very High/);
    await closeThinkPicker(terminal, runtime);

    await switchModel(terminal, runtime, 'mistral', 'zai-glm-5-2');
    const glm52Picker = await openThinkPicker(terminal, runtime);
    runtime.printScreen('/think on Mistral GLM-5.2', terminal);
    assert.match(glm52Picker, /High\s+Deep reasoning/);
    assert.doesNotMatch(glm52Picker, /Light reasoning|Balanced reasoning|Very High|Unbounded reasoning/);
    assert.doesNotMatch(glm52Picker, /Warning: current model \(mistral\//);
    await closeThinkPicker(terminal, runtime);

    await switchModel(terminal, runtime, 'mistral', 'zai-glm-5-3');
    const glm53Picker = await openThinkPicker(terminal, runtime);
    runtime.printScreen('/think on Mistral GLM-5.3', terminal);
    assert.match(glm53Picker, /Low\s+Light reasoning/);
    assert.match(glm53Picker, /High\s+Deep reasoning/);
    assert.match(glm53Picker, /Max\s+Unbounded reasoning/);
    assert.doesNotMatch(glm53Picker, /Balanced reasoning|Very High/);
    assert.doesNotMatch(glm53Picker, /Warning: current model \(mistral\//);
    await closeThinkPicker(terminal, runtime);
    terminal.submit('/think max');
    await runtime.waitForScreenText(/Thinking: Max \(session override\)/, terminal, 8_000);

    for (const provider of ['perplexity', 'perplexity-agent']) {
      await switchModel(terminal, runtime, provider, 'openai/gpt-5.5');
      const perplexityPicker = await openThinkPicker(terminal, runtime);
      runtime.printScreen(`/think on ${provider} GPT-5.5`, terminal);
      assert.match(perplexityPicker, /Off\s+Reasoning disabled/);
      assert.match(perplexityPicker, /Low\s+Light reasoning/);
      assert.match(perplexityPicker, /Medium\s+Balanced reasoning/);
      assert.match(perplexityPicker, /High\s+Deep reasoning/);
      assert.match(perplexityPicker, /Very High\s+Maximum reasoning depth/);
      assert.doesNotMatch(perplexityPicker, /Unbounded reasoning/);
      assert.doesNotMatch(perplexityPicker, new RegExp(`Warning: current model \\(${provider}/`));
      await closeThinkPicker(terminal, runtime);
    }

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;
