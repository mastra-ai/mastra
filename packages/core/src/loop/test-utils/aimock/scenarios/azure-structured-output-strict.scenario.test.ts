import { createAzure as createAzureV5 } from '@ai-sdk/azure';
import { createAzure as createAzureV6 } from '@ai-sdk/azure-v6';
import type { JSONSchema7 } from 'json-schema';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { AzureOpenAIGateway } from '../../../../llm/model/gateways/azure';
import { ModelRouterLanguageModel } from '../../../../llm/model/router';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Structured output and tools on Azure OpenAI models (#28593).
 *
 * Azure OpenAI rejects a strict json_schema unless every property is listed in `required`.
 * Mastra prepared the schema only for `openai.*` providers, so `azure.*` and `azure-openai`
 * requests that went out strict (the AI SDK 6 default, or an explicit `strictJsonSchema: true`
 * on AI SDK 5) carried optional keys outside `required` and were refused with a 400.
 *
 * On AI SDK 5 the same `strictJsonSchema` flag also makes every function tool strict, so Azure
 * also rejected tool schemas with optional keys or keywords such as `uniqueItems`.
 */

const RESOURCE = 'res';
const AZURE_ORIGIN = `https://${RESOURCE}.openai.azure.com/openai`;

const schema = z.object({
  reply: z.string(),
  note: z.string().optional(),
  items: z.array(z.object({ name: z.string(), qty: z.number().optional() })).nullable(),
});

// Strict mode answers optional keys with null.
const strictAnswer = { reply: 'hi', note: null, items: [{ name: 'apple', qty: null }] };

const strictLanes: Array<{ name: string; model: () => any; providerOptions?: Record<string, any> }> = [
  {
    name: 'AI SDK 6 Azure Responses model',
    model: () => createAzureV6({ resourceName: RESOURCE, apiKey: 'test-key' }).responses('gpt-5.4'),
  },
  {
    name: 'AI SDK 6 Azure Chat model',
    model: () => createAzureV6({ resourceName: RESOURCE, apiKey: 'test-key' }).chat('gpt-5.4'),
  },
  {
    name: 'AI SDK 5 Azure Responses model opted into strict mode',
    model: () => createAzureV5({ resourceName: RESOURCE, apiKey: 'test-key' }).responses('gpt-5.4'),
    providerOptions: { openai: { strictJsonSchema: true } },
  },
  {
    name: 'AzureOpenAIGateway Responses model opted into strict mode',
    model: () =>
      new ModelRouterLanguageModel('azure-openai/gpt-5.4', [
        new AzureOpenAIGateway({ resourceName: RESOURCE, apiKey: 'test-key', useResponsesAPI: true }),
      ]),
    providerOptions: { azure: { strictJsonSchema: true } },
  },
];

// Azure rejects `uniqueItems` in a strict schema, and strict mode needs `note` listed in `required`.
const tagOrderInput: JSONSchema7 = {
  type: 'object',
  properties: {
    tags: { type: 'array', items: { type: 'string' }, uniqueItems: true },
    note: { type: 'string' },
  },
  required: ['tags'],
  additionalProperties: false,
};

const strictToolLanes: Array<{
  name: string;
  model: () => any;
  providerOptions: Record<string, any>;
  call: { arguments: Record<string, unknown>; receives: Record<string, unknown> };
}> = [
  {
    name: 'AI SDK 5 Azure Responses model opted into strict mode',
    model: () => createAzureV5({ resourceName: RESOURCE, apiKey: 'test-key' }).responses('gpt-5.4'),
    providerOptions: { openai: { strictJsonSchema: true } },
    call: { arguments: { tags: ['vip'], note: null }, receives: { tags: ['vip'] } },
  },
  {
    name: 'AI SDK 5 Azure Chat model opted into strict mode',
    model: () => createAzureV5({ resourceName: RESOURCE, apiKey: 'test-key' }).chat('gpt-5.4'),
    providerOptions: { openai: { strictJsonSchema: true } },
    call: { arguments: { tags: ['vip'], note: null }, receives: { tags: ['vip'] } },
  },
  {
    // Deployment names without an OpenAI model name skip the OpenAI tool compat layer, so `note`
    // becomes required without accepting null.
    name: 'AI SDK 5 Azure Responses deployment with a custom name opted into strict mode',
    model: () => createAzureV5({ resourceName: RESOURCE, apiKey: 'test-key' }).responses('production'),
    providerOptions: { openai: { strictJsonSchema: true } },
    call: { arguments: { tags: ['vip'], note: 'rush' }, receives: { tags: ['vip'], note: 'rush' } },
  },
  {
    name: 'AzureOpenAIGateway Responses model opted into strict mode',
    model: () =>
      new ModelRouterLanguageModel('azure-openai/gpt-5.4', [
        new AzureOpenAIGateway({ resourceName: RESOURCE, apiKey: 'test-key', useResponsesAPI: true }),
      ]),
    providerOptions: { azure: { strictJsonSchema: true } },
    call: { arguments: { tags: ['vip'], note: null }, receives: { tags: ['vip'] } },
  },
];

describeForAllEngines('AIMock loop scenario: Azure OpenAI structured output', engine => {
  const getMock = useLoopScenarioAimock();

  // AzureOpenAIGateway always calls the resource host and takes no base URL, so every lane calls
  // the real Azure URL and the request is forwarded to AIMock. The body is recorded here because
  // AIMock's journal rewrites Responses bodies into chat messages.
  let sentBodies: any[] = [];
  beforeEach(() => {
    sentBodies = [];
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.startsWith(AZURE_ORIGIN)) return realFetch(input, init);
      if (typeof init?.body === 'string') sentBodies.push(JSON.parse(init.body));
      return realFetch(getMock().url + url.slice(AZURE_ORIGIN.length), init);
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function sentFormat() {
    const body = sentBodies[0] ?? {};
    const format = body.text?.format ?? body.response_format?.json_schema;
    // Key order is not part of the contract, and Inngest runs send `required` in a different order.
    const sorted = (keys: unknown) => (Array.isArray(keys) ? [...keys].sort() : keys);
    return {
      strict: format?.strict,
      required: sorted(format?.schema?.required),
      itemRequired: sorted(format?.schema?.properties?.items?.anyOf?.[0]?.items?.required),
    };
  }

  async function run(model: () => any, providerOptions?: Record<string, any>, answer: unknown = strictAnswer) {
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Reply with a structured object.',
      model,
      structuredOutput: { schema },
      providerOptions,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: JSON.stringify(answer) });
      },
    });
    return (output as unknown as { object: Promise<unknown> }).object.catch((error: unknown) => error);
  }

  for (const lane of strictLanes) {
    it(`${lane.name} sends a strict schema that lists every key as required (#28593)`, async () => {
      await run(lane.model, lane.providerOptions);

      expect(sentFormat()).toEqual({
        strict: true,
        required: ['items', 'note', 'reply'],
        itemRequired: ['name', 'qty'],
      });
    });

    it(`${lane.name} returns the strict answer with null optional keys dropped (#28593)`, async () => {
      const object = await run(lane.model, lane.providerOptions);

      expect(object).toEqual({ reply: 'hi', items: [{ name: 'apple' }] });
    });
  }

  it('AI SDK 5 Azure Responses model keeps its non-strict default request', async () => {
    const object = await run(
      () => createAzureV5({ resourceName: RESOURCE, apiKey: 'test-key' }).responses('gpt-5.4'),
      undefined,
      { reply: 'hi', items: null },
    );

    expect(sentFormat()).toEqual({ strict: false, required: ['items', 'reply'], itemRequired: ['name'] });
    expect(object).toEqual({ reply: 'hi', items: null });
  });

  function sentTool() {
    const tool = sentBodies[0]?.tools?.[0] ?? {};
    // Chat Completions nests the function definition; Responses sends it flat.
    const fn = tool.function ?? tool;
    return { strict: fn.strict, parameters: fn.parameters };
  }

  async function runTool(
    model: () => any,
    providerOptions: Record<string, any> | undefined,
    toolArguments: Record<string, unknown>,
  ) {
    const received: unknown[] = [];
    const tagOrder = createTool({
      id: 'tag_order',
      description: 'Tag an order.',
      inputSchema: tagOrderInput,
      execute: async input => {
        received.push(input);
        return { ok: true };
      },
    });

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Tag the order as vip.',
      model,
      tools: { tag_order: tagOrder },
      providerOptions,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_tag', name: 'tag_order', arguments: toolArguments }] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call_tag', hasToolResult: true }, { content: 'Tagged.' });
      },
    });
    await output.text;
    return received;
  }

  for (const lane of strictToolLanes) {
    it(`${lane.name} sends strict tool schemas that Azure accepts (#28593)`, async () => {
      await runTool(lane.model, lane.providerOptions, lane.call.arguments);

      const { strict, parameters } = sentTool();
      expect(strict).toBe(true);
      expect([...parameters.required].sort()).toEqual(['note', 'tags']);
      expect(JSON.stringify(parameters)).not.toContain('uniqueItems');
      expect(parameters.properties.tags.description).toContain('all items must be unique');
    });

    it(`${lane.name} runs the tool with the arguments of a strict call (#28593)`, async () => {
      const received = await runTool(lane.model, lane.providerOptions, lane.call.arguments);

      expect(received).toEqual([lane.call.receives]);
    });
  }

  it('AI SDK 5 Azure Responses model sends its tool schemas unchanged when not strict', async () => {
    await runTool(() => createAzureV5({ resourceName: RESOURCE, apiKey: 'test-key' }).responses('gpt-5.4'), undefined, {
      tags: ['vip'],
    });

    const { strict, parameters } = sentTool();
    expect(strict).toBe(false);
    expect(parameters.properties.tags.uniqueItems).toBe(true);
  });
});
