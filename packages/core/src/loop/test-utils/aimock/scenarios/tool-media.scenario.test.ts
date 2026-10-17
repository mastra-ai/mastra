import { stepCountIs } from '@internal/ai-v7';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: tool-result media delivery (https://github.com/mastra-ai/mastra/issues/17876).
 *
 * A tool returns an image through `toModelOutput` as a `media` content part.
 * The loop must deliver that image into the next provider request.
 */
describeForAllEngines('AIMock loop scenario: tool-result media delivery', engine => {
  const getMock = useLoopScenarioAimock();

  it('delivers tool-result image media to the next model request', async () => {
    // 1x1 transparent PNG
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    const screenshot = createTool({
      id: 'screenshot',
      description: 'Take a screenshot.',
      inputSchema: z.object({}),
      execute: async () => ({ base64: pngBase64 }),
      toModelOutput: (output: unknown) => ({
        type: 'content' as const,
        value: [{ type: 'media' as const, mediaType: 'image/png', data: (output as { base64: string }).base64 }],
      }),
    });

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Take a screenshot and describe it.',
      tools: { screenshot },
      stopWhen: stepCountIs(3),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_shot', name: 'screenshot', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', toolCallId: 'call_shot', hasToolResult: true }, { content: 'I see the image.' });
      },
    });

    expect(await output.text).toBe('I see the image.');
    expect(requests).toHaveLength(2);
    expect(JSON.stringify(requests[1]?.body?.messages ?? [])).toContain(pngBase64);
  });
});
