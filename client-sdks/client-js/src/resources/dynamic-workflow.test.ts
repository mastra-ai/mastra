import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MastraClient } from '../client';
import type { ListDynamicWorkflowsResponse, DynamicWorkflowDefinition, UpsertDynamicWorkflowParams } from '../types';

const fetchMock = vi.fn();

describe('DynamicWorkflow resource', () => {
  let client: MastraClient;

  const workflow: DynamicWorkflowDefinition = {
    id: 'daily-summary',
    description: 'Summarizes the day',
    inputSchema: { type: 'object', properties: { prompt: { type: 'string' } } },
    outputSchema: { type: 'object', properties: { summary: { type: 'string' } } },
    graph: [{ type: 'tool', id: 'load-items', toolId: 'load-items' }],
    status: 'active',
    source: 'storage',
    createdAt: '2026-07-21T00:00:00.000Z',
    updatedAt: '2026-07-21T00:00:00.000Z',
  };

  const respond = (data: unknown) => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };

  beforeEach(() => {
    fetchMock.mockReset();
    client = new MastraClient({ baseUrl: 'http://localhost:4111', fetch: fetchMock });
  });

  it('lists dynamic workflows with filters', async () => {
    const response: ListDynamicWorkflowsResponse = { workflows: [workflow], total: 1 };
    respond(response);

    await expect(client.listDynamicWorkflows({ status: 'active', authorId: 'user-1' })).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4111/api/stored/workflows?status=active&authorId=user-1',
      expect.any(Object),
    );
  });

  it('upserts a dynamic workflow definition', async () => {
    const input: UpsertDynamicWorkflowParams = {
      id: workflow.id,
      description: workflow.description,
      inputSchema: workflow.inputSchema,
      outputSchema: workflow.outputSchema,
      graph: workflow.graph,
    };
    respond({ ok: true, id: workflow.id });

    await expect(client.upsertDynamicWorkflow(input)).resolves.toEqual({ ok: true, id: workflow.id });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4111/api/stored/workflows',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('gets and deletes an id-scoped dynamic workflow', async () => {
    respond(workflow);
    await expect(client.getDynamicWorkflow('daily summary').details()).resolves.toEqual(workflow);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:4111/api/stored/workflows/daily%20summary',
      expect.any(Object),
    );

    respond({ success: true, message: 'Deleted dynamic workflow daily summary' });
    await expect(client.getDynamicWorkflow('daily summary').delete()).resolves.toEqual({
      success: true,
      message: 'Deleted dynamic workflow daily summary',
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:4111/api/stored/workflows/daily%20summary',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('drives create, retrieve, execute, replace, and delete through the client resources', async () => {
    let stored: DynamicWorkflowDefinition | undefined;
    let revision = 0;

    fetchMock.mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;

      if (url.pathname === '/api/stored/workflows' && init?.method === 'POST') {
        revision += 1;
        stored = {
          ...body,
          status: 'active',
          source: 'storage',
          createdAt: '2026-07-21T00:00:00.000Z',
          updatedAt: `2026-07-21T00:00:0${revision}.000Z`,
        };
        return new Response(JSON.stringify({ ok: true, id: body.id }), { status: 200 });
      }

      if (url.pathname === '/api/stored/workflows/daily-summary' && init?.method === 'DELETE') {
        stored = undefined;
        return new Response(JSON.stringify({ success: true, message: 'Deleted dynamic workflow daily-summary' }), {
          status: 200,
        });
      }

      if (url.pathname === '/api/stored/workflows/daily-summary') {
        return new Response(JSON.stringify(stored), { status: stored ? 200 : 404 });
      }

      if (url.pathname === '/api/stored/workflows') {
        return new Response(JSON.stringify({ workflows: stored ? [stored] : [], total: stored ? 1 : 0 }), {
          status: 200,
        });
      }

      if (url.pathname === '/api/workflows/daily-summary/create-run') {
        return new Response(JSON.stringify({ runId: `run-${revision}` }), { status: 200 });
      }

      if (url.pathname === '/api/workflows/daily-summary/start-async') {
        return new Response(
          JSON.stringify({
            status: 'success',
            result: { summary: `${stored?.description}: ${body.inputData.prompt}` },
            steps: {},
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unhandled fetch to ${url}`);
    });

    const definition: UpsertDynamicWorkflowParams = {
      id: 'daily-summary',
      description: 'Initial summary',
      inputSchema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] },
      outputSchema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] },
      graph: [{ type: 'tool', id: 'load-items', toolId: 'load-items' }],
    };

    await expect(client.upsertDynamicWorkflow(definition)).resolves.toEqual({ ok: true, id: 'daily-summary' });
    await expect(client.getDynamicWorkflow('daily-summary').details()).resolves.toMatchObject(definition);
    await expect(client.listDynamicWorkflows()).resolves.toMatchObject({ total: 1 });

    const firstRun = await client.getWorkflow('daily-summary').createRun();
    await expect(firstRun.startAsync({ inputData: { prompt: 'today' } })).resolves.toMatchObject({
      status: 'success',
      result: { summary: 'Initial summary: today' },
    });

    const replacement = { ...definition, description: 'Replacement summary' };
    await expect(client.upsertDynamicWorkflow(replacement)).resolves.toEqual({ ok: true, id: 'daily-summary' });
    await expect(client.getDynamicWorkflow('daily-summary').details()).resolves.toMatchObject(replacement);

    const replacementRun = await client.getWorkflow('daily-summary').createRun();
    await expect(replacementRun.startAsync({ inputData: { prompt: 'tomorrow' } })).resolves.toMatchObject({
      status: 'success',
      result: { summary: 'Replacement summary: tomorrow' },
    });

    await expect(client.getDynamicWorkflow('daily-summary').delete()).resolves.toEqual({
      success: true,
      message: 'Deleted dynamic workflow daily-summary',
    });
    await expect(client.listDynamicWorkflows()).resolves.toEqual({ workflows: [], total: 0 });
  });

  it('saves helper workflows alongside the root in one upsert and exposes their ids', async () => {
    // A root whose graph nests helpers that do not exist yet cannot be saved on
    // its own. `dependencies` sends them together; the server persists and
    // live-registers the whole set, then echoes the helper ids back.
    const saved = new Map<string, DynamicWorkflowDefinition>();

    fetchMock.mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;

      if (url.pathname === '/api/stored/workflows' && init?.method === 'POST') {
        const { dependencies = [], ...root } = body;
        for (const definition of [...dependencies, root]) {
          saved.set(definition.id, {
            ...definition,
            status: 'active',
            source: 'storage',
            createdAt: '2026-07-21T00:00:00.000Z',
            updatedAt: '2026-07-21T00:00:00.000Z',
          });
        }
        return new Response(
          JSON.stringify({
            ok: true,
            id: root.id,
            ...(dependencies.length ? { dependencyIds: dependencies.map((d: { id: string }) => d.id) } : {}),
          }),
          { status: 200 },
        );
      }

      if (url.pathname === '/api/stored/workflows') {
        const workflows = [...saved.values()];
        return new Response(JSON.stringify({ workflows, total: workflows.length }), { status: 200 });
      }

      const detailMatch = url.pathname.match(/^\/api\/stored\/workflows\/(.+)$/);
      if (detailMatch) {
        const found = saved.get(decodeURIComponent(detailMatch[1]!));
        return new Response(JSON.stringify(found ?? {}), { status: found ? 200 : 404 });
      }

      if (url.pathname === '/api/workflows/parallel-customer-lookup/create-run') {
        return new Response(JSON.stringify({ runId: 'run-1' }), { status: 200 });
      }

      if (url.pathname === '/api/workflows/parallel-customer-lookup/start-async') {
        return new Response(
          JSON.stringify({
            status: 'success',
            result: { first: body.inputData.firstEmail, second: body.inputData.secondEmail },
            steps: {},
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unhandled fetch to ${url}`);
    });

    const helper = (id: string, field: string): UpsertDynamicWorkflowParams => ({
      id,
      description: `Look up ${field}`,
      inputSchema: { type: 'object', properties: { [field]: { type: 'string' } }, required: [field] },
      outputSchema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] },
      graph: [{ type: 'mapping', id: `pick-${field}`, mapConfig: JSON.stringify({ email: { path: field } }) }],
    });

    const root: UpsertDynamicWorkflowParams = {
      id: 'parallel-customer-lookup',
      description: 'Looks up two customers in parallel',
      inputSchema: {
        type: 'object',
        properties: { firstEmail: { type: 'string' }, secondEmail: { type: 'string' } },
        required: ['firstEmail', 'secondEmail'],
      },
      outputSchema: {
        type: 'object',
        properties: { first: { type: 'string' }, second: { type: 'string' } },
        required: ['first', 'second'],
      },
      graph: [
        {
          type: 'parallel',
          steps: [
            { type: 'workflow', id: 'lookup-first', workflowId: 'lookup-first' },
            { type: 'workflow', id: 'lookup-second', workflowId: 'lookup-second' },
          ],
        },
      ],
      dependencies: [helper('lookup-first', 'firstEmail'), helper('lookup-second', 'secondEmail')],
    };

    await expect(client.upsertDynamicWorkflow(root)).resolves.toEqual({
      ok: true,
      id: 'parallel-customer-lookup',
      dependencyIds: ['lookup-first', 'lookup-second'],
    });

    // Helpers are ordinary dynamic workflows — individually retrievable and listed.
    await expect(client.getDynamicWorkflow('lookup-first').details()).resolves.toMatchObject({
      id: 'lookup-first',
      description: 'Look up firstEmail',
    });
    await expect(client.listDynamicWorkflows()).resolves.toMatchObject({ total: 3 });

    // The root is immediately runnable through the ordinary workflow resource.
    const run = await client.getWorkflow('parallel-customer-lookup').createRun();
    await expect(
      run.startAsync({ inputData: { firstEmail: 'ada@example.com', secondEmail: 'grace@example.com' } }),
    ).resolves.toMatchObject({
      status: 'success',
      result: { first: 'ada@example.com', second: 'grace@example.com' },
    });
  });
});
