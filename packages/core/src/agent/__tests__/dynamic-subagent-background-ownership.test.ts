import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { MockStore } from '../../storage';
import { Agent } from '../agent';

const WAIT_TIMEOUT_MS = 10_000;

it('keeps asynchronously selected subagents on their owning instance with distinct request contexts', async () => {
  const storage = new MockStore();
  const instances: Mastra[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const executions: string[] = [];

  function makeSupervisor() {
    return new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'Delegate to helper.',
      model: new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'tool-call', toolCallId: 'delegate', toolName: 'agent-helper', input: '{"prompt":"hi"}' },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        }),
      }),
      agents: async ({ requestContext }) => {
        const selected = requestContext.get('selected') as string;
        return {
          helper: new Agent({
            id: `helper-${selected}`,
            name: 'helper',
            description: 'Selected helper.',
            instructions: 'Reply.',
            model: new MockLanguageModelV2({
              doStream: async () => {
                executions.push(selected);
                if (selected === 'A') await gate;
                return {
                  stream: convertArrayToReadableStream([
                    { type: 'stream-start', warnings: [] },
                    { type: 'text-start', id: 'answer' },
                    { type: 'text-delta', id: 'answer', delta: selected },
                    { type: 'text-end', id: 'answer' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                    },
                  ]),
                };
              },
            }),
          }),
        };
      },
      backgroundTasks: { tools: { helper: { enabled: true } } },
    });
  }

  async function makeInstance() {
    const supervisor = makeSupervisor();
    const instance = new Mastra({
      logger: false,
      storage,
      agents: { supervisor },
      backgroundTasks: { enabled: true, globalConcurrency: 1, perAgentConcurrency: 1, recoverStaleTasksOnStart: false },
    });
    instances.push(instance);
    await instance.startWorkers();
    return { instance, supervisor };
  }

  async function delegate(supervisor: Agent, selected: string) {
    const requestContext = new RequestContext<{ selected: string }>();
    requestContext.set('selected', selected);
    const stream = await supervisor.stream('Delegate.', { requestContext, runId: selected, maxSteps: 1 });
    await stream.consumeStream();
  }

  const tasks = async () => (await instances[0]!.backgroundTaskManager!.listTasks({})).tasks;
  try {
    const origin = await makeInstance();
    await delegate(origin.supervisor, 'A');
    await vi.waitFor(() => expect(executions).toEqual(['A']), { timeout: WAIT_TIMEOUT_MS });
    await delegate(origin.supervisor, 'B');
    expect(await tasks()).toEqual(expect.arrayContaining([expect.objectContaining({ runId: 'B', status: 'pending' })]));
    const remote = await makeInstance();
    await delegate(remote.supervisor, 'C');
    await vi.waitFor(
      async () =>
        expect(await tasks()).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ runId: 'A', status: 'running' }),
            expect.objectContaining({ runId: 'B', status: 'pending' }),
            expect.objectContaining({
              runId: 'C',
              status: 'completed',
              result: expect.objectContaining({ text: 'C' }),
            }),
          ]),
        ),
      { timeout: WAIT_TIMEOUT_MS },
    );
    expect(executions).toEqual(['A', 'C']);
    release();
    await vi.waitFor(
      async () => {
        const completed = await tasks();
        expect(completed).toHaveLength(3);
        for (const selected of ['A', 'B', 'C']) {
          expect(completed).toContainEqual(
            expect.objectContaining({
              runId: selected,
              status: 'completed',
              result: expect.objectContaining({ text: selected }),
            }),
          );
        }
      },
      { timeout: WAIT_TIMEOUT_MS },
    );
    expect(executions).toEqual(['A', 'C', 'B']);
  } finally {
    release();
    for (const instance of instances) {
      await instance.backgroundTaskManager?.shutdown();
      await instance.stopWorkers();
    }
  }
});
