import { describe, expect, it, vi } from 'vitest';

import type { MastraMemory } from '../../memory';
import { HarnessStorage } from '../../storage/domains/harness';
import type { SessionRecord } from '../../storage/domains/harness';
import type { Workspace } from '../../workspace';
import type { Skill } from '../../workspace/skills/types';
import { Harness } from './harness';
import { HarnessSkillNotFoundError } from './skills.types';
import type { HarnessSkillMetadata } from './skills.types';

class RecordingHarnessStorage extends HarnessStorage {
  readonly records = new Map<string, SessionRecord>();

  async dangerouslyClearAll(): Promise<void> {
    this.records.clear();
  }

  async loadSession(sessionId: string): Promise<SessionRecord | null> {
    return this.records.get(sessionId) ?? null;
  }

  async saveSession(record: SessionRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async listSessions(): Promise<SessionRecord[]> {
    return [...this.records.values()];
  }
}

const createMemory = () =>
  ({
    getThreadById: vi.fn().mockResolvedValue(null),
    recall: vi.fn().mockResolvedValue({ messages: [] }),
    saveMessages: vi.fn().mockResolvedValue({ messages: [] }),
  }) as unknown as MastraMemory;

const createSkill = (skill: {
  name: string;
  description: string;
  instructions: string;
  path?: string;
  metadata?: HarnessSkillMetadata;
}): Skill => ({
  name: skill.name,
  description: skill.description,
  instructions: skill.instructions,
  path: skill.path ?? `/skills/${skill.name}`,
  source: { type: 'local', projectPath: skill.path ?? `/skills/${skill.name}` },
  references: [],
  scripts: [],
  assets: [],
  metadata: skill.metadata,
});

interface MockWorkspaceOptions {
  skills: Skill[];
}

const createMockWorkspace = ({ skills }: MockWorkspaceOptions) => {
  const list = vi
    .fn()
    .mockImplementation(async () =>
      skills.map(
        ({
          instructions: _instructions,
          source: _source,
          references: _references,
          scripts: _scripts,
          assets: _assets,
          ...metadata
        }) => metadata,
      ),
    );
  const get = vi.fn().mockImplementation(async (name: string) => skills.find(s => s.name === name) ?? null);
  return {
    list,
    get,
    workspace: {
      skills: { list, get },
    } as unknown as Workspace,
  };
};

const openSession = async (harness: Harness<[{ id: 'build'; agentId: 'default'; defaultModelId: string }]>) =>
  harness.session({ threadId: 'thread-1', resourceId: 'resource-1', modeId: 'build', modelId: 'm' });

const createHarness = ({ workspace }: { workspace?: Workspace } = {}) =>
  new Harness({
    agents: {},
    storage: new RecordingHarnessStorage(),
    memory: createMemory(),
    modes: [{ id: 'build', agentId: 'default', defaultModelId: 'm' } as const],
    defaultModeId: 'build',
    // Use a function form so we don't have to satisfy Workspace's constructor
    // validation when the test only needs a stub.
    workspace: workspace ? () => workspace : undefined,
  });

describe('Session skills', () => {
  it('returns workspace skills with required file paths', async () => {
    const mock = createMockWorkspace({
      skills: [
        createSkill({ name: 'demo', description: 'A demo', instructions: 'do the demo' }),
        createSkill({ name: 'other', description: 'Other', instructions: 'other instructions' }),
      ],
    });
    const harness = createHarness({ workspace: mock.workspace });
    const session = await openSession(harness);

    const list = await session.listSkills();
    expect(list.map(s => s.name).sort()).toEqual(['demo', 'other']);
    expect(await session.getSkill('demo')).toMatchObject({
      name: 'demo',
      instructions: 'do the demo',
      filePath: '/skills/demo',
    });
  });

  it('returns null from getSkill for unknown names', async () => {
    const harness = createHarness();
    const session = await openSession(harness);
    expect(await session.getSkill('nope')).toBeNull();
  });

  it('useSkill throws HarnessSkillNotFoundError when missing', async () => {
    const mock = createMockWorkspace({
      skills: [createSkill({ name: 'demo', description: 'd', instructions: 'i' })],
    });
    const harness = createHarness({ workspace: mock.workspace });
    const session = await openSession(harness);

    await expect(session.useSkill('missing')).rejects.toBeInstanceOf(HarnessSkillNotFoundError);
    try {
      await session.useSkill('missing');
    } catch (err) {
      const e = err as HarnessSkillNotFoundError;
      expect(e.skillName).toBe('missing');
      expect(e.searchedSources).toEqual(['workspace']);
    }
  });

  it('does not expose or apply workspace skill args metadata', async () => {
    const mock = createMockWorkspace({
      skills: [
        createSkill({
          name: 'with-args',
          description: 'with args',
          instructions: 'do the thing',
          metadata: { args: { type: 'object', required: ['topic'] }, category: 'writing' },
        }),
      ],
    });
    const harness = createHarness({ workspace: mock.workspace });
    const session = await openSession(harness);

    await expect(session.useSkill('with-args')).resolves.toBe('do the thing');
    await expect(session.getSkill('with-args')).resolves.toMatchObject({
      category: 'writing',
      metadata: { category: 'writing' },
    });
  });

  it('refreshSkills clears the workspace discovery cache', async () => {
    const mock = createMockWorkspace({
      skills: [createSkill({ name: 'ws', description: 'ws', instructions: 'ws body' })],
    });
    const harness = createHarness({ workspace: mock.workspace });
    const session = await openSession(harness);

    await session.listSkills();
    await session.listSkills();
    expect(mock.list).toHaveBeenCalledTimes(1);

    session.refreshSkills();
    await session.listSkills();
    expect(mock.list).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent listSkills into a single workspace discovery', async () => {
    let resolveList: ((value: unknown) => void) | undefined;
    const list = vi.fn().mockImplementation(
      () =>
        new Promise(resolve => {
          resolveList = resolve;
        }),
    );
    const workspace = { skills: { list, get: vi.fn() } } as unknown as Workspace;
    const harness = createHarness({ workspace });
    const session = await openSession(harness);

    const p1 = session.listSkills();
    const p2 = session.listSkills();
    // Wait long enough for the workspace resolution + discovery promise chain
    // to schedule the `list` call but not long enough to require it to resolve.
    await new Promise(r => setImmediate(r));
    expect(list).toHaveBeenCalledTimes(1);

    resolveList?.([]);
    await Promise.all([p1, p2]);
    expect(list).toHaveBeenCalledTimes(1);
  });
});
