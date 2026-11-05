import { createAzure as createAzureV5 } from '@ai-sdk/azure';
import { createAzure as createAzureV6 } from '@ai-sdk/azure-v6';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { AzureOpenAIGateway } from '../../../../llm/model/gateways/azure';
import { ModelRouterLanguageModel } from '../../../../llm/model/router';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Structured output on Azure OpenAI models (#28593).
 *
 * Azure OpenAI rejects a strict json_schema unless every property is listed in `required`.
 * Mastra prepared the schema only for `openai.*` providers, so `azure.*` and `azure-openai`
 * requests that went out strict (the AI SDK 6 default, or an explicit `strictJsonSchema: true`
 * on AI SDK 5) carried optional keys outside `required` and were refused with a 400.
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

describeForAllEngines('AIMock loop scenario: Azure OpenAI structured output', engine => {
  const getMock = useLoopScenarioAimock();
  // Durable and evented runs skip the null-to-undefined transform Agent applies in agent.ts, so a strict
  // answer with null optional keys fails validation there. openai/* models fail the same way on these engines.
  const itStrictAnswer = engine === 'durable' || engine === 'evented' ? it.fails : it;

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
    return {
      strict: format?.strict,
      required: format?.schema?.required,
      itemRequired: format?.schema?.properties?.items?.anyOf?.[0]?.items?.required,
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
        required: ['reply', 'note', 'items'],
        itemRequired: ['name', 'qty'],
      });
    });

    itStrictAnswer(`${lane.name} returns the strict answer with null optional keys dropped (#28593)`, async () => {
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

    expect(sentFormat()).toEqual({ strict: false, required: ['reply', 'items'], itemRequired: ['name'] });
    expect(object).toEqual({ reply: 'hi', items: null });
  });
});
