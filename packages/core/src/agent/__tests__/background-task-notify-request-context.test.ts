import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { createTextStreamModel, readNextRunWithParts, withTimeout } from './signals-test-utils';

/**
 * A tool whose `requestContextSchema` transforms values hands its execute a view holding the
 * transformed values, which keeps the caller's input form behind it. An agent run inside that
 * tool (a sub-agent) validates its own `requestContextSchema` against the input form. The
 * background-task finish report copies the run's context into the wake; copying the
 * transformed values made the woken run fail validation, so the task was never reported.
 */
describe('background-task finish report with a schema-transformed request context', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  async function transformedToolContext() {
    let captured: RequestContext | undefined;
    const tool = createTool({
      id: 'count-tool',
      description: 'Counts',
      inputSchema: z.object({}),
      requestContextSchema: z.object({ count: z.string().transform(Number) }),
      execute: async (_input, context) => {
        captured = context.requestContext;
        return { ok: true };
      },
    });
    await tool.execute!({}, { requestContext: new RequestContext([['count', '5']]) } as any);
    expect(captured?.get('count')).toBe(5);
    return captured!;
  }

  it('wakes the thread with the input form, so the woken run passes validation and reports', async () => {
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'transformed-context-agent',
      name: 'Transformed Context Agent',
      instructions: 'Test',
      memory,
      requestContextSchema: z.object({ count: z.string() }),
      model: createTextStreamModel('the task finished'),
    });
    const ids = { resourceId: 'transformed-user', threadId: 'transformed-thread' };
    const requestContext = await transformedToolContext();

    // The agent accepts this context when the tool hands it over directly.
    const direct = await agent.stream('hi', {
      requestContext,
      memory: { resource: 'other-user', thread: 'other-thread' },
    });
    expect(await direct.text).toBe('the task finished');

    const subscription = await agent.subscribeToThread(ids);
    const nextRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());
    try {
      await agent.__notifyBackgroundTaskFinished({
        ...ids,
        taskId: 'task-1',
        toolCallId: 'call-1',
        toolName: 'research',
        status: 'completed',
        requestContext,
      });
      const run = await withTimeout(nextRun, 'Timed out waiting for the woken run');
      expect(run.value.part?.type).toBe('finish');
      expect(run.value.text).toBe('the task finished');
      const { messages } = await memory.recall(ids);
      expect(JSON.stringify(messages.filter(message => message.role === 'assistant'))).toContain('the task finished');
    } finally {
      subscription.unsubscribe();
    }
  });
});
