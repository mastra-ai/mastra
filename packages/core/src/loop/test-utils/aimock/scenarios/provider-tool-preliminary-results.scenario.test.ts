/**
 * AIMock Scenario: preliminary provider-executed tool results (#28817)
 *
 * OpenAI's image_generation tool streams partial images before the final one. AI SDK v6
 * surfaces each partial as a provider-executed `tool-result` with `preliminary: true`, followed
 * by one final result. Mastra must keep that flag on the chunk so consumers can tell partials
 * from the final image, and only the final result may run processToolResult, be saved as the
 * tool result, and end the provider tool span.
 *
 * aimock's fixture `files` don't emit `partial_image` events, so the Responses stream is
 * scripted with a raw fixture.
 */

import { createOpenAI } from '@ai-sdk/openai-v6';
import { expect, it } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { SpanType } from '../../../../observability';
import type { Processor } from '../../../../processors';
import { captureOutcomeEvents } from '../outcome-test-utils';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

const CALL_ID = 'ig_cat_1';
const PARTIALS = ['UEFSVElBTDE=', 'UEFSVElBTDI='];
const FINAL = 'RklOQUw=';
const THREAD = { threadId: 'image-thread', resourceId: 'image-user' };

function responsesStream() {
  const response = { id: 'resp_1', object: 'response', created_at: 1, model: 'gpt-5', status: 'in_progress' };
  const imageItem = { type: 'image_generation_call', id: CALL_ID, status: 'completed', result: FINAL };
  return [
    { type: 'response.created', response: { ...response, output: [] } },
    {
      type: 'response.output_item.added',
      output_index: 0,
      item: { type: 'image_generation_call', id: CALL_ID, status: 'in_progress', result: null },
    },
    ...PARTIALS.map((partial_image_b64, partial_image_index) => ({
      type: 'response.image_generation_call.partial_image',
      output_index: 0,
      item_id: CALL_ID,
      partial_image_index,
      partial_image_b64,
    })),
    { type: 'response.output_item.done', output_index: 0, item: imageItem },
    {
      type: 'response.completed',
      response: {
        ...response,
        status: 'completed',
        output: [imageItem],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      },
    },
  ];
}

describeForAllEngines('AIMock loop scenario: preliminary provider tool results', engine => {
  const getMock = useLoopScenarioAimock();

  it('marks partial images as preliminary and only finalizes the last image', async () => {
    const llm = getMock();
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const memory = new MockMemory();
    const { observability, ended } = captureOutcomeEvents();
    const processedResults: unknown[] = [];
    const recordResults: Processor = {
      id: 'record-tool-results',
      processToolResult: ({ messageList, result }) => {
        processedResults.push(result);
        return messageList;
      },
    };

    const { chunks, output } = await runLoopScenario({
      engine,
      llm,
      prompt: 'Draw a cat.',
      model: () => openai.responses('gpt-5'),
      tools: { image_generation: openai.tools.imageGeneration({ partialImages: 2 }) },
      memory,
      ...THREAD,
      observability,
      afterStream: async () => {
        await expect.poll(() => ended().length).toBeGreaterThan(0);
      },
      outputProcessors: [recordResults],
      collectChunks: true,
      fixtures: mock => mock.on({}, { raw: { wire: 'openai-responses', events: responsesStream() } }),
    });

    const toolResults = chunks!.filter(chunk => chunk.type === 'tool-result');
    expect(toolResults.map(chunk => [chunk.payload.result, chunk.payload.preliminary ?? false])).toEqual([
      [{ result: PARTIALS[0] }, true],
      [{ result: PARTIALS[1] }, true],
      [{ result: FINAL }, false],
    ]);

    expect(processedResults).toEqual([{ result: FINAL }]);

    const finalResultOnly = [
      expect.objectContaining({ payload: expect.objectContaining({ result: { result: FINAL } }) }),
    ];
    expect(await output.toolResults).toEqual(finalResultOnly);
    const steps = await output.steps;
    expect(steps[0]!.toolResults).toEqual(finalResultOnly);

    const providerSpans = ended(SpanType.PROVIDER_TOOL_CALL);
    expect(providerSpans).toHaveLength(1);
    expect(providerSpans[0]!.output).toEqual({ result: FINAL });

    const { messages } = await memory.recall(THREAD);
    const savedResults = messages.flatMap(message =>
      typeof message.content === 'string'
        ? []
        : (message.content.parts ?? []).flatMap(part =>
            part.type === 'tool-invocation' && part.toolInvocation.state === 'result'
              ? [part.toolInvocation.result]
              : [],
          ),
    );
    expect(savedResults).toEqual([{ result: FINAL }]);
  });
});
