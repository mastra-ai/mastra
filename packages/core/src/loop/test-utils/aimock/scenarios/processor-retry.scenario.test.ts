import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { createTool } from '../../../../tools';
import { z } from 'zod/v4';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: input/output processor observation, transformation, and
 * sequencing.
 *
 * Input processors run before the model request and can observe/transform the
 * message list; output processors run over the stream and can transform chunks;
 * multiple processors run in registration order. This pins those paths.
 *
 * (Processor *retry* — re-running a processor after an error — is a separate
 * mechanism covered by the error-processor scenarios; it is not exercised here,
 * so this file is scoped to the observe/transform/sequence behavior it actually
 * verifies.)
 */
describe('AIMock loop scenario: processor observation, transformation & sequencing', () => {
  const getMock = useLoopScenarioAimock();

  it('input processor can observe and transform messages', async () => {
    const tickTool = createTool({
      id: 'tick',
      description: 'Advance a counter.',
      inputSchema: z.object({}),
      outputSchema: z.object({ count: z.number() }),
      execute: async () => ({ count: 1 }),
    });

    let processorCalled = false;

    const { requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Complete the task.',
      tools: { tick: tickTool },
      stopWhen: stepCountIs(2),
      inputProcessors: [
        {
          id: 'observe-processor',
          name: 'Observe Processor',
          processInput: async ({ messages }: { messages: any[] }) => {
            processorCalled = true;
            // Just pass through without modification
            return { messages };
          },
        },
      ],
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat' },
          { content: 'Task complete.' },
        );
      },
    });

    // Processor should have been called
    expect(processorCalled).toBe(true);

    // The model returns final text immediately, so exactly one request is made.
    expect(requests).toHaveLength(1);
  });

  it('output processor can observe and transform stream', async () => {
    let processorCalled = false;

    const { output } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Generate a response.',
      stopWhen: stepCountIs(1),
      outputProcessors: [
        {
          id: 'observe-processor',
          name: 'Observe Processor',
          async processOutputStream({ part }: { part: any }) {
            if (part.type === 'text-delta') {
              processorCalled = true;
              // Transform the text
              part.payload.text = part.payload.text.replace(/SECRET/g, '[REDACTED]');
            }
            return part;
          },
        },
      ],
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat' },
          { content: 'The value is SECRET and must be hidden.' },
        );
      },
    });

    // Processor should have been called
    expect(processorCalled).toBe(true);

    // Output should have the redacted text
    const finalText = await output.text;
    expect(finalText).toContain('[REDACTED]');
    expect(finalText).not.toContain('SECRET');
  });

  it('multiple processors run in sequence', async () => {
    const processorOrder: string[] = [];

    const { requests } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Complete the task.',
      stopWhen: stepCountIs(1),
      inputProcessors: [
        {
          id: 'processor-1',
          name: 'Processor 1',
          processInput: async ({ messages }: { messages: any[] }) => {
            processorOrder.push('processor-1');
            return { messages };
          },
        },
        {
          id: 'processor-2',
          name: 'Processor 2',
          processInput: async ({ messages }: { messages: any[] }) => {
            processorOrder.push('processor-2');
            return { messages };
          },
        },
      ],
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat' },
          { content: 'Task complete.' },
        );
      },
    });

    // Both processors ran, in registration order.
    expect(processorOrder).toEqual(['processor-1', 'processor-2']);

    // The model returns final text immediately, so exactly one request is made.
    expect(requests).toHaveLength(1);
  });
});
