/**
 * A resume persists the payload it resumes the suspended tool call with, alongside the claim. A
 * resume that takes over a claim left behind by a process that died replays that payload, so the
 * decision the dead process received is not lost. See #30285.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent, AGENT_RESUME_CLAIM_STALE_MS } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

const WORKFLOW_NAME = 'agentic-loop';

function createModel() {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      const parts: any[] =
        calls === 1
          ? [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'findUser',
                input: '{"query":"Ada"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'Found Ada.' },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts]),
      };
    },
  });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
}

async function drain(output: { fullStream: AsyncIterable<unknown> }) {
  for await (const _ of output.fullStream) {
    // Consume the stream so the run finishes.
  }
}

/**
 * The suspended tool reports every name it resumed with, and can be held open so a test can look at
 * the claim while the resumed tool is still running.
 */
async function setup({ hold = false }: { hold?: boolean } = {}) {
  const executions: string[] = [];
  const entered = deferred();
  const held = deferred();
  const agent = new Agent({
    id: 'find-user-agent',
    name: 'Find User Agent',
    instructions: 'You find users.',
    model: createModel(),
    tools: {
      findUser: createTool({
        id: 'find-user',
        description: 'Finds a user by name',
        inputSchema: z.object({ query: z.string() }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.object({ name: z.string() }),
        execute: async (_input, context) => {
          if (!context?.agent?.resumeData) return context?.agent?.suspend({ message: 'Which user?' });
          const { name } = context.agent.resumeData as { name: string };
          executions.push(name);
          if (hold) {
            entered.resolve();
            await held.promise;
          }
          return { name };
        },
      }),
    },
  });
  const storage = new InMemoryStore();
  const mastra = new Mastra({ agents: { agent }, logger: false, storage });
  const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))!;

  const first = await (await agent.stream('Find the user Ada')).getFullOutput();
  expect(first.finishReason).toBe('suspended');

  return {
    agent,
    executions,
    runId: first.runId!,
    workflowsStore,
    entered: entered.promise,
    release: () => held.resolve(),
  };
}

/** A claim a process took and never started, old enough for a later resume to take it over. */
async function strandClaim(workflowsStore: any, runId: string, payload?: unknown) {
  const stranded = await workflowsStore.updateWorkflowState({
    workflowName: WORKFLOW_NAME,
    runId,
    opts: {
      status: 'pending',
      expectedStatus: 'suspended',
      resumeClaimedAt: Date.now() - (AGENT_RESUME_CLAIM_STALE_MS + 1_000),
      resumeClaimedPayload: payload,
    },
  });
  expect(stranded?.status).toBe('pending');
}

describe('resume claim payload', () => {
  it('persists the payload with the claim while the resumed tool runs', async () => {
    const { agent, executions, runId, workflowsStore, entered, release } = await setup({ hold: true });

    const resume = agent.resumeStream({ name: 'Ada' }, { runId });
    await entered;

    const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: WORKFLOW_NAME, runId });
    expect(snapshot?.status).toBe('running');
    expect(snapshot?.resumeClaimedPayload).toEqual({ name: 'Ada' });

    release();
    await drain(await resume);
    expect(executions).toEqual(['Ada']);
  }, 30_000);

  it('replays the payload a claim left by a dead process persisted', async () => {
    const { agent, executions, runId, workflowsStore } = await setup();
    await strandClaim(workflowsStore, runId, { name: 'Ada' });

    const resumed = await (await agent.resumeClaimedRun({ runId })).getFullOutput();

    expect(resumed.text).toBe('Found Ada.');
    expect(executions).toEqual(['Ada']);
  }, 30_000);

  it('prefers the payload the caller supplies over the stored one', async () => {
    const { agent, executions, runId, workflowsStore } = await setup();
    await strandClaim(workflowsStore, runId, { name: 'Ada' });

    const resumed = await (await agent.resumeStream({ name: 'Grace' }, { runId })).getFullOutput();

    expect(resumed.text).toBe('Found Ada.');
    expect(executions).toEqual(['Grace']);
  }, 30_000);

  it('does not replay a payload a released claim cleared', async () => {
    const { agent, executions, runId, workflowsStore } = await setup();

    vi.spyOn(agent, 'getLLM').mockRejectedValueOnce(new Error('model resolution failed'));
    await expect(agent.resumeStream({ name: 'Ada' }, { runId })).rejects.toThrow('model resolution failed');

    const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: WORKFLOW_NAME, runId });
    expect(snapshot?.status).toBe('suspended');
    expect(snapshot?.resumeClaimedPayload).toBeUndefined();

    // Nothing to replay, so a resume without the decision is rejected the same way it always was.
    await expect(agent.resumeClaimedRun({ runId })).rejects.toMatchObject({ id: 'AGENT_RESUME_INVALID_DATA' });
    expect(executions).toEqual([]);

    await drain(await agent.resumeStream({ name: 'Ada' }, { runId }));
    expect(executions).toEqual(['Ada']);
  }, 30_000);
});
