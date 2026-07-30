import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MastraClient } from '../client';
import type { ListStoredWorkflowsResponse, StoredWorkflowDefinition, UpsertStoredWorkflowParams } from '../types';

const fetchMock = vi.fn();

describe('StoredWorkflow resource', () => {
  let client: MastraClient;

  const workflow: StoredWorkflowDefinition = {
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

  it('lists stored workflows with filters', async () => {
    const response: ListStoredWorkflowsResponse = { workflows: [workflow], total: 1 };
    respond(response);

    await expect(client.listStoredWorkflows({ status: 'active', authorId: 'user-1' })).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4111/api/stored/workflows?status=active&authorId=user-1',
      expect.any(Object),
    );
  });

  it('upserts a stored workflow definition', async () => {
    const input: UpsertStoredWorkflowParams = {
      id: workflow.id,
      description: workflow.description,
      inputSchema: workflow.inputSchema,
      outputSchema: workflow.outputSchema,
      graph: workflow.graph,
    };
    respond({ ok: true, id: workflow.id });

    await expect(client.upsertStoredWorkflow(input)).resolves.toEqual({ ok: true, id: workflow.id });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4111/api/stored/workflows',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('gets and deletes an id-scoped stored workflow', async () => {
    respond(workflow);
    await expect(client.getStoredWorkflow('daily summary').details()).resolves.toEqual(workflow);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:4111/api/stored/workflows/daily%20summary',
      expect.any(Object),
    );

    respond({ success: true, message: 'Deleted stored workflow daily summary' });
    await expect(client.getStoredWorkflow('daily summary').delete()).resolves.toEqual({
      success: true,
      message: 'Deleted stored workflow daily summary',
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:4111/api/stored/workflows/daily%20summary',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('drives create, retrieve, execute, replace, and delete through the client resources', async () => {
    let stored: StoredWorkflowDefinition | undefined;
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
        return new Response(JSON.stringify({ success: true, message: 'Deleted stored workflow daily-summary' }), {
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

    const definition: UpsertStoredWorkflowParams = {
      id: 'daily-summary',
      description: 'Initial summary',
      inputSchema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] },
      outputSchema: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] },
      graph: [{ type: 'tool', id: 'load-items', toolId: 'load-items' }],
    };

    await expect(client.upsertStoredWorkflow(definition)).resolves.toEqual({ ok: true, id: 'daily-summary' });
    await expect(client.getStoredWorkflow('daily-summary').details()).resolves.toMatchObject(definition);
    await expect(client.listStoredWorkflows()).resolves.toMatchObject({ total: 1 });

    const firstRun = await client.getWorkflow('daily-summary').createRun();
    await expect(firstRun.startAsync({ inputData: { prompt: 'today' } })).resolves.toMatchObject({
      status: 'success',
      result: { summary: 'Initial summary: today' },
    });

    const replacement = { ...definition, description: 'Replacement summary' };
    await expect(client.upsertStoredWorkflow(replacement)).resolves.toEqual({ ok: true, id: 'daily-summary' });
    await expect(client.getStoredWorkflow('daily-summary').details()).resolves.toMatchObject(replacement);

    const replacementRun = await client.getWorkflow('daily-summary').createRun();
    await expect(replacementRun.startAsync({ inputData: { prompt: 'tomorrow' } })).resolves.toMatchObject({
      status: 'success',
      result: { summary: 'Replacement summary: tomorrow' },
    });

    await expect(client.getStoredWorkflow('daily-summary').delete()).resolves.toEqual({
      success: true,
      message: 'Deleted stored workflow daily-summary',
    });
    await expect(client.listStoredWorkflows()).resolves.toEqual({ workflows: [], total: 0 });
  });
});
