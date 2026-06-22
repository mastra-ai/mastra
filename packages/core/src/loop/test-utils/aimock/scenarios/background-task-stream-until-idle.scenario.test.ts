import { describe, it, expect } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * Regression class: `streamUntilIdle` re-invocation on background task completion.
 *
 * When using `streamUntilIdle`, the stream stays open after the initial turn
 * and subscribes to background task lifecycle events. When a background task
 * completes, the stream re-invokes the agent so it can process the result.
 *
 * This pins three behaviors:
 *  - the stream stays open when no background tasks have completed yet,
 *  - task completion triggers re-invocation of the model,
 *  - the final text includes the continuation response.
 */
describe('AIMock loop scenario: streamUntilIdle re-invokes on background task completion', () => {
  const getMock = useLoopScenarioAimock();

  it('re-invokes the model after a background task completes', async () => {
    const memory = new MockMemory();

    const {
      output,
      mastra,
      agent,
      llm: mockInstance,
    } = await runLoopScenario({
      llm: getMock(),
      prompt: 'Do background research',
      memory,
      threadId: 'thread-idle-1',
      resourceId: 'user-1',
      backgroundTasks: { enabled: true },
      streamUntilIdle: true,
      manualStreamConsumption: true,
      fixtures: llm => {
        // Initial turn response.
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'Dispatching research in background.' });
        // Continuation after background task completes — model re-invoked.
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Research is done, here are the findings.' });
      },
    });

    const bgManager = mastra.backgroundTaskManager as any;
    expect(bgManager).toBeDefined();

    // Publish lifecycle events to simulate a background task completing.
    const publishEvent = (type: string, taskId: string) =>
      bgManager.publishLifecycleEvent(type, {
        id: taskId,
        toolName: 'research',
        toolCallId: `call-${taskId}`,
        runId: 'run-1',
        agentId: agent.id,
        threadId: 'thread-idle-1',
        resourceId: 'user-1',
        status: type.split('.')[1],
        result: {},
        retryCount: 0,
        maxRetries: 0,
        timeoutMs: 1000,
        createdAt: new Date(),
        args: { topic: 'AI' },
      });

    // Mark a task as running so streamUntilIdle stays open.
    await publishEvent('task.running', 'task-1');
    await new Promise(r => setTimeout(r, 50));
    // Complete it — triggers re-invocation.
    await publishEvent('task.completed', 'task-1');

    // Now drain the stream to let the re-invocation complete.
    const textChunks: string[] = [];
    for await (const chunk of output.fullStream as AsyncIterable<any>) {
      if (chunk.type === 'text-delta') {
        textChunks.push(chunk.delta || chunk.text || chunk.payload?.text || '');
      }
    }

    // Get requests AFTER the stream is consumed (they're populated as the stream runs)
    const requests = mockInstance.getRequests();

    // The model was invoked at least twice: initial turn + continuation.
    expect(requests.length).toBeGreaterThanOrEqual(2);

    // The continuation response made it into the output.
    const fullText = textChunks.join('');
    expect(fullText).toContain('Research is done');
  });
});
