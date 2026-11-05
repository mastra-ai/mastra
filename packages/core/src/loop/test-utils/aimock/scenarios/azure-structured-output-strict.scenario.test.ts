import { createAzure as createAzureV5 } from '@ai-sdk/azure';
import { createAzure as createAzureV6 } from '@ai-sdk/azure-v6';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Structured output on Azure OpenAI models (#28593).
 *
 * Azure OpenAI rejects a strict json_schema unless every property is listed in `required`.
 * Mastra prepared the schema only for `openai.*` providers, so `azure.*` requests that went out
 * strict (the AI SDK 6 default, or an explicit `strictJsonSchema: true` on AI SDK 5) carried
 * optional keys outside `required` and were refused with a 400.
 */

const schema = z.object({
  reply: z.string(),
  note: z.string().optional(),
  items: z.array(z.object({ name: z.string(), qty: z.number().optional() })).nullable(),
});

// Strict mode answers optional keys with null.
const strictAnswer = { reply: 'hi', note: null, items: [{ name: 'apple', qty: null }] };

type AzureFactory = typeof createAzureV5 | typeof createAzureV6;

const strictLanes: Array<{
  name: string;
  createAzure: AzureFactory;
  model: (azure: any) => any;
  providerOptions?: Record<string, any>;
}> = [
  { name: 'AI SDK 6 Azure Responses model', createAzure: createAzureV6, model: azure => azure.responses('gpt-5.4') },
  { name: 'AI SDK 6 Azure Chat model', createAzure: createAzureV6, model: azure => azure.chat('gpt-5.4') },
  {
    name: 'AI SDK 5 Azure Responses model opted into strict mode',
    createAzure: createAzureV5,
    model: azure => azure.responses('gpt-5.4'),
    providerOptions: { openai: { strictJsonSchema: true } },
  },
];

/**
 * AIMock's journal rewrites Responses bodies into chat messages, so record the body the Azure
 * provider sends and forward it unchanged.
 */
function recordingFetch() {
  const bodies: any[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    if (typeof init?.body === 'string') bodies.push(JSON.parse(init.body));
    return fetch(input, init);
  };
  const sentFormat = () => {
    const body = bodies[0] ?? {};
    const format = body.text?.format ?? body.response_format?.json_schema;
    return {
      strict: format?.strict,
      required: format?.schema?.required,
      itemRequired: format?.schema?.properties?.items?.anyOf?.[0]?.items?.required,
    };
  };
  return { fetch: fetchFn, sentFormat };
}

describeForAllEngines('AIMock loop scenario: Azure OpenAI structured output', engine => {
  const getMock = useLoopScenarioAimock();
  // Durable and evented runs skip the null-to-undefined transform Agent applies in agent.ts, so a strict
  // answer with null optional keys fails validation there. openai/* models fail the same way on these engines.
  const itStrictAnswer = engine === 'durable' || engine === 'evented' ? it.fails : it;

  async function run(
    createAzure: AzureFactory,
    model: (azure: any) => any,
    providerOptions?: Record<string, any>,
    answer: unknown = strictAnswer,
  ) {
    const wire = recordingFetch();
    const azure = createAzure({ apiKey: 'test-key', baseURL: getMock().url, fetch: wire.fetch });
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Reply with a structured object.',
      model: () => model(azure),
      structuredOutput: { schema },
      providerOptions,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: JSON.stringify(answer) });
      },
    });
    const object = await (output as unknown as { object: Promise<unknown> }).object.catch((error: unknown) => error);
    return { object, format: wire.sentFormat() };
  }

  for (const lane of strictLanes) {
    it(`${lane.name} sends a strict schema that lists every key as required (#28593)`, async () => {
      const { format } = await run(lane.createAzure, lane.model, lane.providerOptions);

      expect(format).toEqual({ strict: true, required: ['reply', 'note', 'items'], itemRequired: ['name', 'qty'] });
    });

    itStrictAnswer(`${lane.name} returns the strict answer with null optional keys dropped (#28593)`, async () => {
      const { object } = await run(lane.createAzure, lane.model, lane.providerOptions);

      expect(object).toEqual({ reply: 'hi', items: [{ name: 'apple' }] });
    });
  }

  it('AI SDK 5 Azure Responses model keeps its non-strict default request', async () => {
    const { object, format } = await run(createAzureV5, azure => azure.responses('gpt-5.4'), undefined, {
      reply: 'hi',
      items: null,
    });

    expect(format).toEqual({ strict: false, required: ['reply', 'items'], itemRequired: ['name'] });
    expect(object).toEqual({ reply: 'hi', items: null });
  });
});
