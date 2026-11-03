/**
 * AIMock Scenario: messages an input-step processor removes stay removed
 *
 * Memory compaction drops observed messages from the list in processInputStep once a run is past its
 * first step. Every processor after it in the same step must see the list without them, and a processor
 * that returns its `messages` array must not put them back into the request.
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import type { MastraDBMessage, MessageList } from '../../../../agent/message-list';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

const OLD_NOTE = 'OLD_NOTE: the build was green yesterday.';

describeForAllEngines('AIMock loop scenario: messages removed by an input-step processor', engine => {
  const getMock = useLoopScenarioAimock();

  const lookupTool = createTool({
    id: 'lookup',
    description: 'Look up a value.',
    inputSchema: z.object({ key: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    execute: async ({ key }) => ({ value: `VALUE_FOR_${key}` }),
  });

  /** Drops the old note once the run is past its first step, the way memory compaction does. */
  const pruner = {
    id: 'pruner',
    async processInputStep({ stepNumber, messageList }: { stepNumber: number; messageList: MessageList }) {
      if (stepNumber >= 1) {
        const old = messageList.get.all.db().filter(m => JSON.stringify(m.content).includes(OLD_NOTE));
        messageList.removeByIds(old.map(m => m.id));
      }
      return messageList;
    },
  };

  async function run(inputProcessors: unknown[]) {
    const { requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: [
        { role: 'user', content: OLD_NOTE },
        { role: 'user', content: 'Look up the value for key alpha.' },
      ] as any,
      tools: { lookup: lookupTool },
      stopWhen: stepCountIs(5),
      inputProcessors: inputProcessors as any,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: { key: 'alpha' } }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'The value for alpha is VALUE_FOR_alpha.' });
      },
    });
    return requests.map(request => JSON.stringify(request.body));
  }

  it('hands the next processor the list without them, and returning that list keeps them out', async () => {
    const handed: string[][] = [];
    const passThrough = {
      id: 'pass-through',
      async processInputStep({ stepNumber, messages }: { stepNumber: number; messages: MastraDBMessage[] }) {
        if (stepNumber >= 1) handed.push(messages.map(m => JSON.stringify(m.content)));
        return messages;
      },
    };

    const bodies = await run([pruner, passThrough]);

    expect(bodies).toHaveLength(2);
    expect(bodies[0]!.includes('OLD_NOTE'), 'the first request has the note').toBe(true);
    expect(bodies[1]!.includes('OLD_NOTE'), 'the removed note came back into the second request').toBe(false);
    expect(
      handed[0]!.some(content => content.includes('OLD_NOTE')),
      'the next processor was handed the removed note',
    ).toBe(false);
  });

  it('keeps them out when no later processor returns the array (control)', async () => {
    const bodies = await run([pruner]);

    expect(bodies).toHaveLength(2);
    expect(bodies[1]!.includes('OLD_NOTE')).toBe(false);
  });
});
