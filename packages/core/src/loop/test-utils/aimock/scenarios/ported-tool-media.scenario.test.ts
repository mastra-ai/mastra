import { createAnthropic as createAnthropicV5 } from '@ai-sdk/anthropic-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario } from '../aimock-scenario';
import { useScriptedProviders } from '../scripted-sse';

/**
 * Ported from the AI SDK tool-media suite (formerly test-utils/tool-media.ts).
 * A tool returns an image through `toModelOutput` as a `media` content part.
 * AI SDK v5 providers read `media`; v6 providers only read `image-data`, so
 * the loop has to translate before the prompt reaches them (#17876). Here
 * real Anthropic v5 and v6 providers build the follow-up request, and the
 * test checks the image block that goes over the wire.
 */

// 1x1 transparent PNG
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function anthropicEvents(blocks: unknown[][], stopReason: string) {
  return [
    {
      type: 'message_start',
      message: { id: 'msg_a', model: 'claude-sonnet-4-5', usage: { input_tokens: 3, output_tokens: 0 } },
    },
    ...blocks.flat(),
    { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 10 } },
    { type: 'message_stop' },
  ];
}

const toolUse = [
  {
    type: 'content_block_start',
    index: 0,
    content_block: { type: 'tool_use', id: 'toolu_1', name: 'screenshot', input: {} },
  },
  { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{}' } },
  { type: 'content_block_stop', index: 0 },
];

const textBlock = [
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'I see the image.' } },
  { type: 'content_block_stop', index: 0 },
];

describeForAllEngines('AIMock loop scenario: ported tool-result image media', engine => {
  const p = useScriptedProviders();

  it.each([
    {
      version: 'v5',
      model: () => createAnthropicV5({ apiKey: 'aimock', baseURL: `${p.llm.url}/anthropic/v1` })('claude-sonnet-4-5'),
    },
    { version: 'v6', model: () => p.anthropicModel() },
  ])('delivers tool-result image media to the $version provider request', async ({ model }) => {
    p.anthropic.responses.push(anthropicEvents([toolUse], 'tool_use'), anthropicEvents([textBlock], 'end_turn'));
    const screenshot = createTool({
      id: 'screenshot',
      description: 'takes a screenshot',
      inputSchema: z.object({}),
      execute: async () => ({ base64: pngBase64 }),
      toModelOutput: (output: { base64: string }) => ({
        type: 'content' as const,
        value: [{ type: 'media' as const, mediaType: 'image/png', data: output.base64 }],
      }),
    });
    const { output } = await runLoopScenario({
      engine,
      llm: p.llm,
      model: model(),
      tools: { screenshot },
      prompt: 'take a screenshot',
      maxSteps: 3,
      fixtures: () => {},
    });

    expect(await output.text).toBe('I see the image.');
    expect(p.anthropic.requests).toHaveLength(2);
    const toolResults = p.anthropic.requests[1].messages
      .flatMap((m: any) => (Array.isArray(m.content) ? m.content : []))
      .filter((part: any) => part.type === 'tool_result');
    expect(toolResults).toEqual([
      expect.objectContaining({
        tool_use_id: 'toolu_1',
        content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: pngBase64 } }],
      }),
    ]);
  });
});
