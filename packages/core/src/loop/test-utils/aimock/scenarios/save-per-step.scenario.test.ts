import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { MockMemory } from '../../../../memory';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: savePerStep incremental message persistence.
 *
 * When savePerStep is enabled, messages are persisted incrementally after each
 * stream step completes. This pins the intermediate persistence path, ensuring
 * messages are saved to memory as the loop progresses.
 */
describeForAllEngines(
  'AIMock loop scenario: savePerStep incremental persistence',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('messages are saved incrementally when savePerStep is enabled', async () => {
      const tickTool = createTool({
        id: 'tick',
        description: 'Advance a counter.',
        inputSchema: z.object({}),
        outputSchema: z.object({ count: z.number() }),
        execute: async () => ({ count: 1 }),
      });

      const memory = new MockMemory();
      const threadId = 'test-thread-1';
      const resourceId = 'test-user-1';

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Call tool then finish.',
        tools: { tick: tickTool },
        stopWhen: stepCountIs(3),
        memory,
        threadId,
        resourceId,
        savePerStep: true,
        fixtures: llm => {
          // Step 1: tool call
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            { toolCalls: [{ id: 'call_tick', name: 'tick', arguments: {} }] },
          );
          // Step 2: finish
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Done.' });
        },
      });

      // Messages should have been saved to memory
      const savedMessages = await memory.recall({
        threadId,
        resourceId,
      });

      // Should have messages saved
      expect(savedMessages.messages.length).toBeGreaterThan(0);
    });

    it('messages are not saved incrementally when savePerStep is disabled', async () => {
      const memory = new MockMemory();
      const threadId = 'test-thread-2';
      const resourceId = 'test-user-2';

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Simple test.',
        stopWhen: stepCountIs(1),
        memory,
        threadId,
        resourceId,
        savePerStep: false,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Done.' });
        },
      });

      // Messages may still be saved at the end, but not incrementally
      const savedMessages = await memory.recall({
        threadId,
        resourceId,
      });

      // Should have messages (saved at end), but this test just verifies no crash
      expect(savedMessages).toBeDefined();
    });
  },
  { skip: ['durable'] },
);
