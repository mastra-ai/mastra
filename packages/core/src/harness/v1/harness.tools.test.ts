import { RequestContext } from '@internal/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import type { MastraMemory } from '../../memory';
import { HarnessStorage } from '../../storage/domains/harness';
import type { SessionRecord } from '../../storage/domains/harness';
import { Harness } from './harness';
import { buildHarnessBuiltInTools } from './tools';

class MemStore extends HarnessStorage {
  readonly records = new Map<string, SessionRecord>();
  async dangerouslyClearAll(): Promise<void> {
    this.records.clear();
  }
  async loadSession(id: string): Promise<SessionRecord | null> {
    return this.records.get(id) ?? null;
  }
  async saveSession(rec: SessionRecord): Promise<void> {
    this.records.set(rec.id, rec);
  }
  async listSessions(): Promise<SessionRecord[]> {
    return [...this.records.values()];
  }
}

const memory = {
  getThreadById: vi.fn().mockResolvedValue({
    id: 'thread-1',
    resourceId: 'resource-1',
    title: 'Tools',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  }),
  recall: vi.fn().mockResolvedValue({ messages: [] }),
} as unknown as MastraMemory;

const echoTool = { id: 'echo', description: 'echo', parameters: {} as never, execute: async () => null } as never;

describe('Harness — tools/skills/subagents config', () => {
  it('keeps skills session-scoped and hides raw harness registries', async () => {
    const skill = {
      name: 'demo',
      description: 'A demo skill',
      instructions: 'do the demo',
      path: '/skills/demo',
      source: { type: 'local', projectPath: '/skills/demo' },
      references: [],
      scripts: [],
      assets: [],
    };
    const workspace = {
      skills: {
        list: vi.fn().mockResolvedValue([{ name: skill.name, description: skill.description, path: skill.path }]),
        get: vi.fn().mockResolvedValue(skill),
      },
    };
    const harness = new Harness({
      agent: {} as never,
      memory,
      storage: new MemStore(),
      modes: [{ id: 'build', agentId: 'default', defaultModelId: 'm', tools: { echo: echoTool } }],
      defaultModeId: 'build',
      workspace: () => workspace as never,
    });

    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });

    await expect(session.listSkills()).resolves.toEqual([
      {
        name: 'demo',
        description: 'A demo skill',
        instructions: 'do the demo',
        filePath: '/skills/demo',
      },
    ]);
    expect('getSkills' in harness).toBe(false);
    expect('getSubagents' in harness).toBe(false);
  });

  it('does not expose internal tool override helpers on the Session', async () => {
    const harness = new Harness({
      agent: {} as never,
      memory,
      storage: new MemStore(),
      modes: [{ id: 'build', agentId: 'default', defaultModelId: 'm', tools: { echo: echoTool } }],
      defaultModeId: 'build',
    });

    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1', modeId: 'build' });
    expect('getToolOverrides' in session).toBe(false);
  });

  it('keeps built-in task tools owned by the calling session', async () => {
    const storage = new MemStore();
    const harness = new Harness({
      agent: {} as never,
      memory,
      storage,
      modes: [{ id: 'build', agentId: 'default', defaultModelId: 'm' }],
      defaultModeId: 'build',
    });
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    const tools = buildHarnessBuiltInTools(session) as Record<
      string,
      { execute: (input: unknown, context: unknown) => Promise<unknown> }
    >;
    const requestContext = new RequestContext<unknown>();
    requestContext.set('harness', { sessionId: session.id });

    await tools.task_write.execute(
      {
        tasks: [{ id: 'task-1', content: 'Do work', status: 'pending', activeForm: 'Doing work' }],
      },
      { requestContext },
    );
    await tools.task_complete.execute({ id: 'task-1' }, { requestContext });

    expect(session.getState()).toMatchObject({
      tasks: [{ id: 'task-1', content: 'Do work', status: 'completed', activeForm: 'Doing work' }],
    });
    expect(storage.records.get(session.id)?.state).toMatchObject({
      tasks: [{ id: 'task-1', content: 'Do work', status: 'completed', activeForm: 'Doing work' }],
    });
    expect(storage.records.get(session.id)).not.toHaveProperty('tasks');
  });

  it('returns a recoverable error when built-in tools execute for a different session', async () => {
    const harness = new Harness({
      agent: {} as never,
      memory,
      storage: new MemStore(),
      modes: [{ id: 'build', agentId: 'default', defaultModelId: 'm' }],
      defaultModeId: 'build',
    });
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    const tools = buildHarnessBuiltInTools(session) as Record<
      string,
      { execute: (input: unknown, context: unknown) => Promise<unknown> }
    >;
    const requestContext = new RequestContext<unknown>();
    requestContext.set('harness', { sessionId: 'other-session' });

    await expect(tools.task_check.execute({}, { requestContext })).resolves.toMatchObject({
      isError: true,
      code: 'harness.tool_failed',
    });
  });

  it('creates durable child sessions through the subagent built-in and enforces depth cap', async () => {
    const storage = new MemStore();
    const resolveModel = vi.fn().mockReturnValue({});
    const mastra = {
      getStorage: vi.fn(() => undefined),
      getAgentById: vi.fn((agentId: string) => {
        if (agentId === 'default') return {};
        throw new Error(`missing agent ${agentId}`);
      }),
    };
    const harness = new Harness({
      mastra: mastra as never,
      agent: 'default',
      memory,
      storage,
      runtimeCompatibilityGeneration: 'runtime-v1',
      modes: [{ id: 'build', agentId: 'default', defaultModelId: 'm' }],
      defaultModeId: 'build',
      sessions: { maxSubagentDepth: 1 },
      subagents: {
        types: { explore: { name: 'Explore', description: 'd', agentId: 'default', defaultModelId: 'm-sub' } },
      },
      resolveModel,
    });
    const parent = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    const tools = buildHarnessBuiltInTools(parent) as Record<
      string,
      { execute: (input: unknown, context: unknown) => Promise<unknown> }
    >;
    const requestContext = new RequestContext<unknown>();
    requestContext.set('harness', { sessionId: parent.id });

    const result = await tools.subagent.execute(
      { agentType: 'explore', prompt: 'inspect harness', forked: true },
      { requestContext },
    );

    expect(result).toMatchObject({ isError: false, agentType: 'explore', depth: 1 });
    const childId = (result as { subagentSessionId: string }).subagentSessionId;
    expect(resolveModel).toHaveBeenCalledWith('m-sub');
    expect(storage.records.get(childId)).toMatchObject({
      id: childId,
      parentSessionId: parent.id,
      origin: 'subagent-tool',
      source: { type: 'subagent-tool', parentSessionId: parent.id },
      subagentDepth: 1,
      resourceId: 'resource-1',
      modelId: 'm-sub',
      pending: [],
      runtimeCompatibilityGeneration: 'runtime-v1',
    });

    const child = await harness.session({ sessionId: childId });
    const childTools = buildHarnessBuiltInTools(child) as Record<
      string,
      { execute: (input: unknown, context: unknown) => Promise<unknown> }
    >;
    const childContext = new RequestContext<unknown>();
    childContext.set('harness', { sessionId: child.id });
    const beforeRecordCount = storage.records.size;

    await expect(
      childTools.subagent.execute({ agentType: 'explore', prompt: 'too deep' }, { requestContext: childContext }),
    ).resolves.toEqual({
      isError: true,
      code: 'harness.subagent_depth_exceeded',
      message: 'Harness subagent depth 2 exceeds the configured maximum of 1',
      details: { maxDepth: 1, attemptedDepth: 2 },
    });
    expect(storage.records.size).toBe(beforeRecordCount);
  });

  it('does not create child records when subagent agent resolution fails', async () => {
    const storage = new MemStore();
    const mastra = {
      getStorage: vi.fn(() => undefined),
      getAgentById: vi.fn((agentId: string) => {
        if (agentId === 'default') return {};
        throw new Error(`missing agent ${agentId}`);
      }),
    };
    const harness = new Harness({
      mastra: mastra as never,
      agent: 'default',
      memory,
      storage,
      modes: [{ id: 'build', agentId: 'default', defaultModelId: 'm' }],
      defaultModeId: 'build',
      sessions: { maxSubagentDepth: 1 },
      subagents: {
        types: { broken: { name: 'Broken', description: 'd', agentId: 'missing', defaultModelId: 'm-sub' } },
      },
      resolveModel: vi.fn(),
    });
    const parent = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    const tools = buildHarnessBuiltInTools(parent) as Record<
      string,
      { execute: (input: unknown, context: unknown) => Promise<unknown> }
    >;
    const requestContext = new RequestContext<unknown>();
    requestContext.set('harness', { sessionId: parent.id });
    const beforeRecordCount = storage.records.size;

    await expect(
      tools.subagent.execute({ agentType: 'broken', prompt: 'inspect harness' }, { requestContext }),
    ).resolves.toMatchObject({ isError: true, code: 'harness.tool_failed' });
    expect(storage.records.size).toBe(beforeRecordCount);
  });

  it('validates subagent depth and runtime compatibility configuration', async () => {
    const storage = new MemStore();
    const harness = new Harness({
      agent: {} as never,
      memory,
      storage,
      runtimeCompatibilityGeneration: 'runtime-v1',
      modes: [{ id: 'build', agentId: 'default', defaultModelId: 'm' }],
      defaultModeId: 'build',
      sessions: { maxSubagentDepth: 2 },
      subagents: { types: { explore: { name: 'Explore', description: 'd', agentId: 'default' } } },
      resolveModel: vi.fn(),
    });

    await expect(harness.init()).resolves.toBeUndefined();
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });

    expect(storage.records.get(session.id)).toMatchObject({
      runtimeCompatibilityGeneration: 'runtime-v1',
    });
    expect('resolveToolCategory' in harness).toBe(false);
    expect('resolveModel' in harness).toBe(false);
  });
});
