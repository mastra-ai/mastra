import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { MastraModelOutput } from '../../stream/base/output';
import { HarnessValidationError } from './errors';
import type { HarnessEvent } from './events';
import { Harness } from './harness';

interface FakeRun {
  finishReason: 'stop' | 'suspended';
  text?: string;
  runId?: string;
  suspendPayload?: {
    toolCallId: string;
    toolName: string;
    args?: unknown;
    suspendPayload?: unknown;
  };
}

class FakeAgent extends Agent<any, any, any> {
  runs: FakeRun[] = [];
  resumeCalls: Array<{ resumeData: unknown; options: any }> = [];

  constructor(id = 'default') {
    super({ id, name: id, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
  }

  enqueueRun(run: FakeRun): void {
    this.runs.push(run);
  }

  async stream(_messages: unknown, options?: any): Promise<MastraModelOutput> {
    const run = this.runs.shift();
    if (!run) throw new Error('FakeAgent: no stream run enqueued');
    const output = buildOutput({ ...run, runId: run.runId ?? options?.runId ?? 'fake-run' });
    this._internalRegisterStreamRun(output, (options ?? {}) as any);
    return output;
  }

  async resumeStream(resumeData: unknown, options?: any): Promise<MastraModelOutput> {
    this.resumeCalls.push({ resumeData, options });
    const run = this.runs.shift();
    if (!run) throw new Error('FakeAgent: no resume run enqueued');
    const output = buildOutput({ ...run, runId: run.runId ?? options?.runId ?? 'fake-run' });
    this._internalRegisterStreamRun(output, (options ?? {}) as any);
    return output;
  }
}

function setup(modes?: any[]) {
  const agent = new FakeAgent('default');
  const storage = new InMemoryHarness({ db: new InMemoryDB() });
  const resolvedModes = modes ?? [{ id: 'default', agentId: 'default' }];
  const harness = new Harness({
    agents: { default: agent } as any,
    modes: resolvedModes,
    defaultModeId: resolvedModes[0]!.id,
    sessions: { storage },
  });
  return { harness, agent };
}

describe('Session suspensions', () => {
  it('captures tool approval suspensions and emits suspension_required', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-approval',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'rm -rf /tmp/x' } },
    });
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });
    const events: HarnessEvent[] = [];
    session.subscribe(event => events.push(event));

    const result = await session.message({ content: 'do it' });

    expect(result.finishReason).toBe('suspended');
    expect(session.getRecord().pendingResume).toMatchObject({
      kind: 'tool-approval',
      runId: 'run-approval',
      toolCallId: 'tc-1',
      toolName: 'shell',
      payload: { input: { cmd: 'rm -rf /tmp/x' } },
    });
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'suspension_required', kind: 'tool-approval', toolCallId: 'tc-1' }),
      ]),
    );
  });

  it('resumes a pending approval and clears pendingResume', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-approval',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell', args: { cmd: 'echo ok' } },
    });
    agent.enqueueRun({ finishReason: 'stop', runId: 'run-approval', text: 'approved' });
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true }, modelId: 'gpt-5' });

    await session.message({ content: 'do it' });
    const result = await session.respondToToolApproval({ approved: true, reason: 'ok' });

    expect(result.text).toBe('approved');
    expect(agent.resumeCalls).toHaveLength(1);
    expect(agent.resumeCalls[0]!.resumeData).toEqual({ approved: true, reason: 'ok' });
    expect(agent.resumeCalls[0]!.options).toMatchObject({ runId: 'run-approval', toolCallId: 'tc-1', model: 'gpt-5' });
    expect(session.getRecord().pendingResume).toBeUndefined();
  });

  it('classifies questions and forwards answer resume data', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-question',
      suspendPayload: {
        toolCallId: 'tc-question',
        toolName: 'ask_user',
        args: {
          question: 'pick one',
          options: [{ label: 'red' }, { label: 'blue' }],
          selectionMode: 'single_select',
        },
      },
    });
    agent.enqueueRun({ finishReason: 'stop', runId: 'run-question', text: 'answered' });
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });

    await session.message({ content: 'ask' });
    expect(session.getRecord().pendingResume).toMatchObject({
      kind: 'question',
      payload: {
        question: 'pick one',
        options: [{ label: 'red' }, { label: 'blue' }],
        selectionMode: 'single_select',
      },
    });

    await session.respondToQuestion({ answer: 'red' });
    expect(agent.resumeCalls[0]!.resumeData).toEqual({ answer: 'red' });
  });

  it('applies plan approval mode transitions', async () => {
    const { harness, agent } = setup([
      { id: 'planner', agentId: 'default', transitionsTo: 'builder' },
      { id: 'builder', agentId: 'default' },
    ]);
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-plan',
      suspendPayload: {
        toolCallId: 'tc-plan',
        toolName: 'submit_plan',
        args: { title: 'Plan', plan: 'do it' },
      },
    });
    agent.enqueueRun({ finishReason: 'stop', runId: 'run-plan', text: 'approved' });
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });

    await session.message({ content: 'plan' });
    expect(session.getRecord().pendingResume).toMatchObject({
      kind: 'plan-approval',
      transitionModeId: 'builder',
      payload: { title: 'Plan', plan: 'do it' },
    });

    await session.respondToPlanApproval({ approved: true });
    expect(session.getCurrentMode().id).toBe('builder');
  });

  it('rejects wrong-kind responses', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-approval',
      suspendPayload: { toolCallId: 'tc-1', toolName: 'shell' },
    });
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });

    await session.message({ content: 'do it' });

    await expect(session.respondToQuestion({ answer: 'nope' })).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('parks queued work on suspension and resolves the queue promise after resume', async () => {
    const { harness, agent } = setup();
    agent.enqueueRun({
      finishReason: 'suspended',
      runId: 'run-queued',
      suspendPayload: { toolCallId: 'tc-queue', toolName: 'shell' },
    });
    agent.enqueueRun({ finishReason: 'stop', runId: 'run-queued', text: 'queued done' });
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });

    const queued = session.queue({ content: 'queued work' });
    await waitFor(() => session.getRecord().pendingResume !== undefined, 'queued suspension');

    expect(session.getQueueDepth()).toBe(1);
    expect(session.getRecord().pendingResume).toMatchObject({
      kind: 'tool-approval',
      queuedItemId: expect.any(String),
    });

    await session.respondToToolApproval({ approved: true });
    await expect(queued).resolves.toMatchObject({ text: 'queued done' });
    expect(session.getQueueDepth()).toBe(0);
  });
});

function buildOutput(run: FakeRun): MastraModelOutput {
  const fullOutput = {
    text: run.text ?? '',
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    finishReason: run.finishReason,
    object: undefined,
    steps: [],
    warnings: [],
    providerMetadata: undefined,
    request: {},
    reasoning: [],
    reasoningText: undefined,
    toolCalls: [],
    toolResults: [],
    sources: [],
    files: [],
    response: { id: 'response-1', timestamp: new Date(), modelId: 'fake', messages: [], uiMessages: [] },
    totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    error: undefined,
    tripwire: undefined,
    traceId: undefined,
    spanId: undefined,
    runId: run.runId ?? 'fake-run',
    suspendPayload: run.suspendPayload,
    messages: [],
    rememberedMessages: [],
  };
  const fullStream = (async function* () {})();
  return {
    runId: fullOutput.runId,
    getFullOutput: async () => fullOutput,
    fullStream,
    text: Promise.resolve(fullOutput.text),
    finishReason: Promise.resolve(fullOutput.finishReason),
    usage: Promise.resolve(fullOutput.usage),
    _waitUntilFinished: () => Promise.resolve(),
  } as unknown as MastraModelOutput;
}

async function waitFor(predicate: () => boolean, label: string, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise(resolve => setImmediate(resolve));
  }
}
