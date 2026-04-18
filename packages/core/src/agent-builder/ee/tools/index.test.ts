import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStore } from '../../../storage/mock';
import { addTaskTool, listTasksTool, proposeAgentTool, updateTaskTool } from './index';

function makeMastra(storage: InMemoryStore) {
  // Minimal MastraUnion-ish stub exposing the storage the tools need.
  return { getStorage: () => storage } as any;
}

describe('project tools', () => {
  let storage: InMemoryStore;
  let mastra: ReturnType<typeof makeMastra>;

  beforeEach(async () => {
    storage = new InMemoryStore();
    mastra = makeMastra(storage);
    const agents = await storage.getStore('agents');
    await agents!.create({
      agent: {
        id: 'project-1',
        role: 'supervisor',
        metadata: { project: { isProject: true, tasks: [], invitedAgentIds: [], invitedSkillIds: [] } },
        name: 'PM',
        instructions: 'Coordinate the team',
        model: { provider: 'openai', name: 'gpt-4' },
      },
    });
  });

  it('adds, lists, and updates tasks', async () => {
    const added = await addTaskTool.execute(
      { title: 'First task', description: 'Do thing' } as any,
      { mastra, requestContext: { get: (k: string) => (k === 'projectId' ? 'project-1' : undefined) } } as any,
    );
    expect(added.title).toBe('First task');
    expect(added.status).toBe('open');

    const listed = await listTasksTool.execute(
      {} as any,
      { mastra, requestContext: { projectId: 'project-1' } } as any,
    );
    expect(listed.tasks).toHaveLength(1);

    const updated = await updateTaskTool.execute(
      { taskId: added.id, status: 'in_progress' } as any,
      { mastra, requestContext: { projectId: 'project-1' } } as any,
    );
    expect(updated.status).toBe('in_progress');
  });

  it('rejects a non-supervisor target', async () => {
    const agents = await storage.getStore('agents');
    await agents!.create({
      agent: {
        id: 'agent-1',
        name: 'A',
        instructions: 'a',
        model: { provider: 'openai', name: 'gpt-4' },
      },
    });

    await expect(
      addTaskTool.execute({ title: 't', projectId: 'agent-1' } as any, { mastra, requestContext: {} } as any),
    ).rejects.toThrow(/not a project/);
  });

  it('proposeAgent returns a proposal payload', async () => {
    const agents = await storage.getStore('agents');
    await agents!.create({
      agent: {
        id: 'candidate-1',
        name: 'Candidate',
        instructions: 'c',
        model: { provider: 'openai', name: 'gpt-4' },
      },
    });
    const out = await proposeAgentTool.execute(
      { agentId: 'candidate-1', reason: 'helpful' } as any,
      { mastra, requestContext: { projectId: 'project-1' } } as any,
    );
    expect(out.kind).toBe('proposal');
    expect(out.agentId).toBe('candidate-1');
  });
});
