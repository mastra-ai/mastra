import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MastraClient } from '../client';
import type {
  ListStoredWorkflowsResponse,
  StoredWorkflowDefinition,
  UpsertStoredWorkflowParams,
  WorkflowBuilderSettingsResponse,
} from '../types';

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

  it('gets workflow builder settings', async () => {
    const response: WorkflowBuilderSettingsResponse = {
      enabled: true,
      modelPolicy: { active: true, pickerVisible: false },
    };
    respond(response);

    await expect(client.getWorkflowBuilderSettings()).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4111/api/editor/workflow-builder/settings',
      expect.any(Object),
    );
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
});
