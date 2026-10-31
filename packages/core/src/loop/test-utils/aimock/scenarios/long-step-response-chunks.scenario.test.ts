import { expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../../events';
import { MockMemory } from '../../../../memory/mock';
import { InMemoryStore } from '../../../../storage/mock';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

const TOOL_STEPS = 8;
const RESULT_BYTES = 20_000;

class MeasuringPubSub extends EventEmitterPubSub {
  stepFinishBytes: number[] = [];

  override async publish(...args: Parameters<EventEmitterPubSub['publish']>): Promise<void> {
    const chunk = args[1]?.data;
    if (chunk?.type === 'step-finish' && chunk.payload && '_durableResponseMessages' in chunk.payload) {
      this.stepFinishBytes.push(JSON.stringify(chunk.payload._durableResponseMessages).length);
    }
    return super.publish(...args);
  }
}

describeForAllEngines('AIMock loop scenario: long memory-backed tool stream (#27475)', engine => {
  const getMock = useLoopScenarioAimock();

  it('streams each tool result once, retains the full response, and avoids repeated durable transport history', async () => {
    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage });
    const pubsub = new MeasuringPubSub();
    const threadId = 'long-step-response-chunks';
    const expectedIds = Array.from({ length: TOOL_STEPS }, (_, i) => `call-${i + 1}`);
    let executed = 0;

    try {
      const { chunks, output, requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Collect eight large results, then finish',
        memory,
        threadId,
        resourceId: 'long-step-resource',
        pubsub,
        collectChunks: true,
        maxSteps: TOOL_STEPS + 2,
        tools: {
          shot: {
            parameters: { type: 'object', properties: {}, required: [] },
            execute: async () => ({ image: 'x'.repeat(RESULT_BYTES), index: ++executed }),
          },
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [{ id: expectedIds[0]!, name: 'shot', arguments: {} }],
            },
          );
          for (let i = 1; i < TOOL_STEPS; i++) {
            llm.on(
              { endpoint: 'chat', toolCallId: expectedIds[i - 1] },
              {
                toolCalls: [{ id: expectedIds[i]!, name: 'shot', arguments: {} }],
              },
            );
          }
          llm.on({ endpoint: 'chat', toolCallId: expectedIds.at(-1) }, { content: 'done' });
        },
      });

      expect(requests).toHaveLength(TOOL_STEPS + 1);
      expect(executed).toBe(TOOL_STEPS);
      expect((chunks ?? []).filter(c => c.type === 'tool-result').map(c => c.payload.toolCallId)).toEqual(expectedIds);
      expect(await output.text).toBe('done');
      const response = await output.response;
      const resultIds = response.messages.flatMap(message =>
        message.role === 'tool' && Array.isArray(message.content)
          ? message.content.filter(part => part.type === 'tool-result').map(part => part.toolCallId)
          : [],
      );
      // Inngest currently leaves output.response.messages empty; verify its persisted transcript below.
      if (engine !== 'inngest') expect(resultIds).toEqual(expectedIds);

      const stored = await (await storage.getStore('memory'))!.listMessages({ threadId, perPage: false });
      const storedIds = stored.messages.flatMap(message =>
        message.content.parts.flatMap(part =>
          part.type === 'tool-invocation' && part.toolInvocation.state === 'result'
            ? [part.toolInvocation.toolCallId]
            : [],
        ),
      );
      expect(storedIds).toEqual(expectedIds);

      if (engine === 'durable' || engine === 'evented') {
        expect(pubsub.stepFinishBytes).toHaveLength(TOOL_STEPS + 1);
        expect(Math.max(...pubsub.stepFinishBytes)).toBeLessThan(2.5 * RESULT_BYTES);
        expect(pubsub.stepFinishBytes.reduce((total, bytes) => total + bytes, 0)).toBeLessThan(15 * RESULT_BYTES);
      }
    } finally {
      await pubsub.close();
    }
  }, 60000);
});
