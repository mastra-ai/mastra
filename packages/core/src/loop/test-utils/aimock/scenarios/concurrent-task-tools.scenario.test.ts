import { expect, it } from 'vitest';
import { Memory } from '../../../../../../memory/src';
import { TaskSignalProvider } from '../../../../signals';
import { InMemoryThreadStateStorage } from '../../../../storage/domains/thread-state/inmemory';
import { TASK_STATE_TYPE, taskWriteTool } from '../../../../tools/builtin/task-tools';
import type { TaskItemSnapshot } from '../../../../tools/builtin/task-tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

// Hold the first database write while another thread makes progress. Without
// serialization, the second tool reads the old list and its update is lost.
class PausedTaskStore extends InMemoryThreadStateStorage {
  readonly entered = Promise.withResolvers<void>();
  readonly release = Promise.withResolvers<void>();
  pause = false;

  override async setState<T>(args: { threadId: string; type: string; value: T }): Promise<void> {
    if (this.pause && args.threadId === 'tasks') {
      this.pause = false;
      this.entered.resolve();
      await this.release.promise;
    }
    await super.setState(args);
  }
}

describeForAllEngines('concurrent task tools', engine => {
  const getMock = useLoopScenarioAimock();

  it('keeps both task updates from one parallel model step (#28268)', async () => {
    const llm = getMock();
    const defaultOptions = {
      autoResumeSuspendedTools: false,
      toolCallConcurrency: { limit: 3, strategy: 'called' as const },
    };
    const memory = new Memory({ options: { generateTitle: false } });
    const shared = await createSharedAgent(llm, {
      engine,
      memory,
      signals: [new TaskSignalProvider()],
      defaultOptions,
    });
    const store = new PausedTaskStore();
    shared.mastra.getStorage().stores.threadState = store;
    const initial: TaskItemSnapshot[] = [
      { id: 'a', content: 'Task A', activeForm: 'Doing A', status: 'in_progress' },
      { id: 'b', content: 'Task B', activeForm: 'Doing B', status: 'pending' },
    ];
    await store.setState({ threadId: 'tasks', type: TASK_STATE_TYPE, value: initial });
    store.pause = true;
    const running = runLoopScenario({
      engine,
      llm,
      sharedAgent: shared,
      memory,
      prompt: 'Finish A and start B.',
      threadId: 'tasks',
      resourceId: 'resource',
      maxSteps: 4,
      fixtures: mock => {
        mock.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          {
            toolCalls: [
              { id: 'finish-a', name: 'task_update', arguments: { id: 'a', status: 'completed' } },
              { id: 'start-b', name: 'task_update', arguments: { id: 'b', status: 'in_progress' } },
            ],
          },
        );
        mock.on(
          { endpoint: 'chat', sequenceIndex: 1 },
          { toolCalls: [{ id: 'check', name: 'task_check', arguments: {} }] },
        );
        mock.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'Done.' });
      },
    });
    try {
      await Promise.race([
        store.entered.promise,
        running.then(() => {
          throw new Error('Agent finished without writing tasks');
        }),
      ]);
      const independent = await taskWriteTool.execute!(
        { tasks: initial },
        {
          mastra: shared.mastra,
          agent: {
            threadId: 'other',
            resourceId: 'resource',
            agentId: 'test',
            toolCallId: 'other',
            messages: [],
            suspend: async () => {},
          },
        },
      );
      expect(independent.isError).toBe(false);
    } finally {
      store.release.resolve();
    }
    const { output, requests } = await running;
    expect(await output.text).toContain('Done.');
    const tasks = await store.getState<TaskItemSnapshot[]>({ threadId: 'tasks', type: TASK_STATE_TYPE });
    expect(tasks?.map(task => [task.id, task.status])).toEqual([
      ['a', 'completed'],
      ['b', 'in_progress'],
    ]);
    expect(JSON.stringify(requests.at(-1)?.body.messages)).toContain('Task Status: [1/2 completed]');
  });
});
