import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import type { MastraModelOutput } from '../../stream/base/output';
import { Harness } from './harness';
import {
  ASK_USER_TOOL_ID,
  SUBMIT_PLAN_TOOL_ID,
  TASK_CHECK_TOOL_ID,
  TASK_WRITE_TOOL_ID,
  askUser,
  harnessBuiltInTools,
  submitPlan,
  taskCheck,
  taskWrite,
} from './tools';

class FakeAgent extends Agent<any, any, any> {
  calls: Array<{ messages: unknown; options: any }> = [];

  constructor(id = 'default') {
    super({ id, name: id, instructions: 'fake', model: 'openai/gpt-4o-mini' as any });
  }

  async stream(messages: unknown, options?: any): Promise<MastraModelOutput> {
    this.calls.push({ messages, options });
    const output = buildOutput();
    this._internalRegisterStreamRun(output, (options ?? {}) as any);
    return output;
  }
}

describe('Harness v1 built-in tools', () => {
  it('exports the built-in toolset under stable ids', () => {
    expect(Object.keys(harnessBuiltInTools).sort()).toEqual(
      [ASK_USER_TOOL_ID, SUBMIT_PLAN_TOOL_ID, TASK_CHECK_TOOL_ID, TASK_WRITE_TOOL_ID].sort(),
    );
  });

  it('askUser suspends first and returns resume data after resume', async () => {
    const suspend = vi.fn(async () => undefined);

    await askUser.execute!({ question: 'pick one', options: [{ label: 'red' }], selectionMode: 'single_select' }, {
      agent: { agentId: 'agent', toolCallId: 'tc-1', messages: [], suspend },
    } as any);

    expect(suspend).toHaveBeenCalledWith({}, undefined);
    await expect(
      askUser.execute!({ question: 'pick one' }, {
        agent: { agentId: 'agent', toolCallId: 'tc-1', messages: [], suspend, resumeData: { answer: 'red' } },
      } as any),
    ).resolves.toEqual({ answer: 'red' });
  });

  it('submitPlan suspends with the submitted plan and returns approval resume data', async () => {
    const suspend = vi.fn(async () => undefined);

    await submitPlan.execute!({ title: 'Plan', plan: 'Do it' }, {
      agent: { agentId: 'agent', toolCallId: 'tc-1', messages: [], suspend },
    } as any);

    expect(suspend).toHaveBeenCalledWith({ title: 'Plan', plan: 'Do it' }, undefined);
    await expect(
      submitPlan.execute!({ plan: 'Do it' }, {
        agent: {
          agentId: 'agent',
          toolCallId: 'tc-1',
          messages: [],
          suspend,
          resumeData: { approved: true, revision: 'ship it' },
        },
      } as any),
    ).resolves.toEqual({ approved: true, revision: 'ship it' });
  });

  it('taskWrite emits task updates and taskCheck handles missing storage', async () => {
    const writer = { custom: vi.fn(async () => undefined) };
    const tasks = [{ content: 'Implement queue', status: 'completed' as const, activeForm: 'Implementing queue' }];

    await expect(taskWrite.execute!({ tasks }, { writer } as any)).resolves.toMatchObject({
      written: 1,
      completed: 1,
    });
    expect(writer.custom).toHaveBeenCalledWith({ type: 'data-task-updated', data: { tasks } });
    await expect(taskCheck.execute!({}, {} as any)).resolves.toEqual({
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      allComplete: false,
      tasks: [],
    });
  });

  it('injects built-in tools into the Harness v1 session toolset', async () => {
    const agent = new FakeAgent('default');
    const harness = new Harness({
      agents: { default: agent } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage: new InMemoryHarness({ db: new InMemoryDB() }) },
    });
    const session = await harness.session({ resourceId: 'resource-a', threadId: { fresh: true } });

    await session.message({ content: 'hello' });

    expect(agent.calls[0]!.options.toolsets['harness:builtin']).toMatchObject({
      [ASK_USER_TOOL_ID]: askUser,
      [SUBMIT_PLAN_TOOL_ID]: submitPlan,
      [TASK_WRITE_TOOL_ID]: taskWrite,
      [TASK_CHECK_TOOL_ID]: taskCheck,
    });
  });
});

function buildOutput(): MastraModelOutput {
  const fullOutput = {
    text: 'ok',
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    finishReason: 'stop',
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
    runId: 'fake-run',
    suspendPayload: undefined,
    messages: [],
    rememberedMessages: [],
  };
  return {
    runId: fullOutput.runId,
    getFullOutput: async () => fullOutput,
    fullStream: (async function* () {})(),
    text: Promise.resolve(fullOutput.text),
    finishReason: Promise.resolve(fullOutput.finishReason),
    usage: Promise.resolve(fullOutput.usage),
    _waitUntilFinished: () => Promise.resolve(),
  } as unknown as MastraModelOutput;
}
