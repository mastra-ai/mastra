import { describe, expect, it, vi } from 'vitest';

import type { MastraMemory } from '../../memory';
import { HarnessStorage } from '../../storage/domains/harness';
import type { SessionRecord } from '../../storage/domains/harness';
import { Harness } from './harness';

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
  it('stores skills, subagents, resolveModel and permission policy', async () => {
    const resolveModel = vi.fn();
    const harness = new Harness({
      agents: { default: {} as never },
      memory,
      storage: new MemStore(),
      modes: [{ id: 'build', agentId: 'default', defaultModelId: 'm', tools: { echo: echoTool } }],
      defaultModeId: 'build',
      skills: [
        {
          name: 'demo',
          description: 'A demo skill',
          instructions: 'do the demo',
          path: '/skills/demo',
          source: { type: 'local', projectPath: '/skills/demo' },
          references: [],
          scripts: [],
          assets: [],
        },
      ],
      subagents: { types: { explore: { name: 'Explore', description: 'd', agentId: 'default' } } },
      resolveModel,
      defaultPermissionPolicy: 'deny',
      toolCategories: { echo: 'read', other: 'execute' },
    });

    expect(harness.getSkills()).toEqual([
      {
        name: 'demo',
        description: 'A demo skill',
        instructions: 'do the demo',
        path: '/skills/demo',
        source: { type: 'local', projectPath: '/skills/demo' },
        references: [],
        scripts: [],
        assets: [],
      },
    ]);
    expect(harness.getSubagents()?.types.explore?.agentId).toBe('default');
    await expect(harness.resolveModel('m')).resolves.toBeUndefined();
    expect(resolveModel).toHaveBeenCalledWith('m');
    expect(harness.getDefaultPermissionPolicy()).toBe('deny');
    expect(harness.resolveToolCategory('echo')).toBe('read');
    expect(harness.resolveToolCategory('missing')).toBeNull();
  });

  it('surfaces mode tool overrides on the Session', async () => {
    const harness = new Harness({
      agents: {},
      memory,
      storage: new MemStore(),
      modes: [{ id: 'build', agentId: 'default', defaultModelId: 'm', tools: { echo: echoTool } }],
      defaultModeId: 'build',
    });

    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1', modeId: 'build' });
    const overrides = session.getToolOverrides();
    expect(overrides.tools).toEqual({ echo: echoTool });
    expect(overrides.additionalTools).toBeUndefined();
  });

  it('toolCategoryResolver wins over toolCategories', () => {
    const resolver = vi.fn().mockReturnValue('mcp');
    const harness = new Harness({
      agents: {},
      memory,
      storage: new MemStore(),
      modes: [{ id: 'build', agentId: 'default', defaultModelId: 'm' }],
      defaultModeId: 'build',
      toolCategoryResolver: resolver,
      toolCategories: { echo: 'read' },
    });
    expect(harness.resolveToolCategory('echo')).toBe('mcp');
    expect(resolver).toHaveBeenCalledWith('echo');
  });
});
