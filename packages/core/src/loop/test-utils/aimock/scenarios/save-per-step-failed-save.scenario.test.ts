import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import {
  runLoopScenario,
  useLoopScenarioAimock,
  describeForAllEngines,
  isDurableEngineVariant,
} from '../aimock-scenario';

/**
 * Story: a support agent saves each step as it goes (savePerStep). The database blips once
 * during the first step's save, then recovers before the run ends.
 *
 * The first step's save drains the unsaved messages before writing. If that write fails and the
 * messages are not marked unsaved again, nothing later writes them: the end-of-run save only
 * writes messages still marked new. The customer's question and the first tool call vanish from
 * the thread, and the next turn answers without them. (#25538 item 4)
 */
describeForAllEngines('Save per step: a failed step save is retried', engine => {
  const getMock = useLoopScenarioAimock();

  const QUESTION = 'Where is order #4821?';
  const STATUS = 'ORDER_4821_SHIPPED_UPS';
  const FINAL_ANSWER = 'It shipped with UPS.';

  const lookupOrder = createTool({
    id: 'lookupOrder',
    description: 'Look up an order by id.',
    inputSchema: z.object({ orderId: z.string() }),
    execute: async () => ({ status: STATUS }),
  });

  async function runWithFailedSave(failOnCall: number) {
    const memory = new MockMemory();
    const store = (await memory.storage.getStore('memory'))!;
    const realSave = store.saveMessages.bind(store);
    let calls = 0;
    let failures = 0;
    // Durable engines persist accepted input before the first step begins.
    const initialSaveCount = isDurableEngineVariant(engine) ? 1 : 0;
    vi.spyOn(store, 'saveMessages').mockImplementation(async args => {
      if (calls++ === failOnCall + initialSaveCount) {
        failures++;
        throw new Error('storage unavailable');
      }
      return realSave(args);
    });
    const threadId = `failed-save-thread-${failOnCall}`;
    const resourceId = 'failed-save-user';

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: QUESTION,
      tools: { lookupOrder },
      stopWhen: stepCountIs(3),
      memory,
      threadId,
      resourceId,
      savePerStep: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_lookup', name: 'lookupOrder', arguments: { orderId: '4821' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: FINAL_ANSWER });
      },
    });

    expect(failures).toBe(1);
    const { messages } = await memory.recall({ threadId, resourceId });
    return { messages, stored: JSON.stringify(messages) };
  }

  it('keeps the user message and first step when the first step save fails', async () => {
    const { messages, stored } = await runWithFailedSave(0);
    expect(
      messages.some(m => m.role === 'user'),
      'user message was lost after the failed save',
    ).toBe(true);
    expect(stored).toContain(QUESTION);
    expect(stored).toContain(STATUS);
    expect(stored).toContain(FINAL_ANSWER);
  });

  it('keeps the final answer when the last step save fails', async () => {
    const { stored } = await runWithFailedSave(1);
    expect(stored).toContain(QUESTION);
    expect(stored).toContain(STATUS);
    expect(stored, 'final answer was lost after the failed save').toContain(FINAL_ANSWER);
  });
});
