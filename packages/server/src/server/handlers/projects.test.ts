/**
 * Tests for project handlers.
 *
 * Projects are stored agents with `role: 'supervisor'` and tasks persisted
 * under `metadata.project.tasks`. These tests exercise the CRUD surface end
 * to end through an in-memory storage store.
 */

import { Mastra } from '@mastra/core';
import { MockStore } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';

import { HTTPException } from '../http-exception';
import {
  CREATE_PROJECT_ROUTE,
  CREATE_PROJECT_TASK_ROUTE,
  DELETE_PROJECT_ROUTE,
  DELETE_PROJECT_TASK_ROUTE,
  GET_PROJECT_ROUTE,
  INVITE_PROJECT_AGENT_ROUTE,
  LIST_PROJECTS_ROUTE,
  REMOVE_PROJECT_AGENT_ROUTE,
  UPDATE_PROJECT_ROUTE,
  UPDATE_PROJECT_TASK_ROUTE,
} from './projects';
import { createTestServerContext } from './test-utils';

function createMastra(): Mastra {
  return new Mastra({ logger: false, storage: new MockStore() });
}

function ctx(mastra: Mastra) {
  return { ...createTestServerContext({ mastra }), request: new Request('http://localhost:4000/projects') } as any;
}

async function createProject(mastra: Mastra, overrides?: Record<string, unknown>) {
  return (await CREATE_PROJECT_ROUTE.handler({
    ...ctx(mastra),
    name: 'Launch Plan',
    description: 'Coordinate the launch',
    instructions: 'Plan and run the launch.',
    model: { provider: 'openai', name: 'gpt-4o' },
    invitedAgentIds: ['research-agent'],
    ...overrides,
  } as any)) as any;
}

describe('POST /projects', () => {
  it('creates a supervisor stored agent with empty tasks and invited agents', async () => {
    const mastra = createMastra();
    const project = await createProject(mastra);
    expect(project.id).toBe('launch-plan');
    expect(project.status).toBe('published');
    expect(project.project.isProject).toBe(true);
    expect(project.project.tasks).toEqual([]);
    expect(project.project.invitedAgentIds).toEqual(['research-agent']);
  });

  it('lists only supervisor agents', async () => {
    const mastra = createMastra();
    await createProject(mastra, { name: 'Alpha' });
    await createProject(mastra, { name: 'Beta' });
    const res = (await LIST_PROJECTS_ROUTE.handler(ctx(mastra))) as any;
    expect(res.projects).toHaveLength(2);
    expect(res.projects.every((p: any) => p.project.isProject === true)).toBe(true);
  });
});

describe('GET /projects/:projectId', () => {
  it('returns a created project', async () => {
    const mastra = createMastra();
    await createProject(mastra);
    const got = (await GET_PROJECT_ROUTE.handler({ ...ctx(mastra), projectId: 'launch-plan' } as any)) as any;
    expect(got.id).toBe('launch-plan');
  });

  it('404s when the agent is not a supervisor', async () => {
    const mastra = createMastra();
    const agents = await mastra.getStorage()!.getStore('agents');
    await agents!.create({
      agent: {
        id: 'plain',
        name: 'Plain',
        description: '',
        instructions: 'x',
        model: { provider: 'openai', name: 'gpt-4o' },
      } as any,
    });
    await expect(GET_PROJECT_ROUTE.handler({ ...ctx(mastra), projectId: 'plain' } as any)).rejects.toBeInstanceOf(
      HTTPException,
    );
  });
});

describe('PATCH /projects/:projectId', () => {
  it('updates name and description', async () => {
    const mastra = createMastra();
    await createProject(mastra);
    const updated = (await UPDATE_PROJECT_ROUTE.handler({
      ...ctx(mastra),
      projectId: 'launch-plan',
      name: 'Launch Plan v2',
      description: 'Updated',
    } as any)) as any;
    expect(updated.name).toBe('Launch Plan v2');
    expect(updated.description).toBe('Updated');
  });
});

describe('DELETE /projects/:projectId', () => {
  it('removes the project', async () => {
    const mastra = createMastra();
    await createProject(mastra);
    const result = (await DELETE_PROJECT_ROUTE.handler({ ...ctx(mastra), projectId: 'launch-plan' } as any)) as any;
    expect(result.deleted).toBe(true);
    await expect(GET_PROJECT_ROUTE.handler({ ...ctx(mastra), projectId: 'launch-plan' } as any)).rejects.toBeInstanceOf(
      HTTPException,
    );
  });
});

describe('invite / remove agent', () => {
  it('adds and removes an invited agent', async () => {
    const mastra = createMastra();
    await createProject(mastra);
    const invited = (await INVITE_PROJECT_AGENT_ROUTE.handler({
      ...ctx(mastra),
      projectId: 'launch-plan',
      agentId: 'copy-agent',
    } as any)) as any;
    expect(invited.project.invitedAgentIds).toEqual(expect.arrayContaining(['research-agent', 'copy-agent']));

    const removed = (await REMOVE_PROJECT_AGENT_ROUTE.handler({
      ...ctx(mastra),
      projectId: 'launch-plan',
      agentId: 'copy-agent',
    } as any)) as any;
    expect(removed.project.invitedAgentIds).not.toContain('copy-agent');
  });
});

describe('project tasks', () => {
  it('supports add, update, and delete', async () => {
    const mastra = createMastra();
    await createProject(mastra);

    const task = (await CREATE_PROJECT_TASK_ROUTE.handler({
      ...ctx(mastra),
      projectId: 'launch-plan',
      title: 'Draft announcement',
    } as any)) as any;
    expect(task.status).toBe('open');

    const updated = (await UPDATE_PROJECT_TASK_ROUTE.handler({
      ...ctx(mastra),
      projectId: 'launch-plan',
      taskId: task.id,
      status: 'done',
      title: 'Announcement drafted',
    } as any)) as any;
    expect(updated.status).toBe('done');
    expect(updated.title).toBe('Announcement drafted');

    const project = (await GET_PROJECT_ROUTE.handler({ ...ctx(mastra), projectId: 'launch-plan' } as any)) as any;
    expect(project.project.tasks).toHaveLength(1);

    const deleted = (await DELETE_PROJECT_TASK_ROUTE.handler({
      ...ctx(mastra),
      projectId: 'launch-plan',
      taskId: task.id,
    } as any)) as any;
    expect(deleted.deleted).toBe(true);

    const after = (await GET_PROJECT_ROUTE.handler({ ...ctx(mastra), projectId: 'launch-plan' } as any)) as any;
    expect(after.project.tasks).toHaveLength(0);
  });
});
