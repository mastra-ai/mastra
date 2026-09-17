import { Mastra } from '@mastra/core';
import { InMemoryStore } from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MASTRA_RESOURCE_ID_KEY, MASTRA_USER_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import { activateAgentVersionBodySchema } from '../schemas/agent-versions';

import { SET_AGENT_VERSION_LABEL_ROUTE } from './agent-version-labels';
import { ACTIVATE_AGENT_VERSION_ROUTE, DELETE_AGENT_VERSION_ROUTE, LIST_AGENT_VERSIONS_ROUTE } from './agent-versions';
import { createTestServerContext } from './test-utils';

async function readHttpError(promise: Promise<unknown>) {
  let error: HTTPException | undefined;
  try {
    await promise;
  } catch (caught) {
    error = caught as HTTPException;
  }
  expect(error).toBeInstanceOf(HTTPException);
  const response = error!.getResponse();
  return { status: response.status, body: await response.json() };
}

describe('agent version publication and label enrichment', () => {
  let storage: InMemoryStore;
  let mastra: Mastra;
  let versionIds: { v1: string; v2: string; v3: string };

  beforeEach(async () => {
    storage = new InMemoryStore();
    mastra = new Mastra({ logger: false, storage });
    const agents = await storage.getStore('agents');
    await agents.create({
      agent: {
        id: 'support-agent',
        name: 'Support v1',
        instructions: 'Version one',
        model: { provider: 'openai', name: 'gpt-5.5' },
      },
    });
    const first = await agents.getLatestVersion('support-agent');
    if (!first) throw new Error('Expected initial version');

    await agents.createVersion({
      id: 'support-v2',
      agentId: 'support-agent',
      versionNumber: 2,
      name: 'Support v2',
      instructions: 'Version two',
      model: { provider: 'openai', name: 'gpt-5.5' },
    });
    await agents.createVersion({
      id: 'support-v3',
      agentId: 'support-agent',
      versionNumber: 3,
      name: 'Support v3',
      instructions: 'Version three',
      model: { provider: 'openai', name: 'gpt-5.5' },
    });
    await agents.update({ id: 'support-agent', activeVersionId: first.id, status: 'published' });
    versionIds = { v1: first.id, v2: 'support-v2', v3: 'support-v3' };
  });

  function context() {
    return createTestServerContext({ mastra });
  }

  it('maps version reads and production movement onto existing permissions', () => {
    expect(LIST_AGENT_VERSIONS_ROUTE.requiresPermission).toBe('stored-agents:read');
    expect(ACTIVATE_AGENT_VERSION_ROUTE.requiresPermission).toBe('stored-agents:publish');
  });

  it('keeps body-less activation valid and unconditional', async () => {
    expect(activateAgentVersionBodySchema.parse(undefined)).toEqual({});

    await expect(
      ACTIVATE_AGENT_VERSION_ROUTE.handler({
        ...context(),
        agentId: 'support-agent',
        versionId: versionIds.v2,
      }),
    ).resolves.toMatchObject({ success: true, activeVersionId: versionIds.v2 });

    const agents = await storage.getStore('agents');
    expect((await agents.getById('support-agent'))?.activeVersionId).toBe(versionIds.v2);
  });

  it('accepts null when the caller observed no production target', async () => {
    const agents = await storage.getStore('agents');
    await agents.create({
      agent: {
        id: 'unpublished-agent',
        name: 'Unpublished agent',
        instructions: 'Draft instructions',
        model: { provider: 'openai', name: 'gpt-5.5' },
      },
    });
    const draft = await agents.getLatestVersion('unpublished-agent');
    if (!draft) throw new Error('Expected unpublished version');

    await expect(
      ACTIVATE_AGENT_VERSION_ROUTE.handler({
        ...context(),
        agentId: 'unpublished-agent',
        versionId: draft.id,
        expectedActiveVersionId: null,
      }),
    ).resolves.toMatchObject({ success: true, activeVersionId: draft.id });
    expect((await agents.getById('unpublished-agent'))?.activeVersionId).toBe(draft.id);
  });

  it('returns a production conflict without changing a stale target', async () => {
    const conflict = await readHttpError(
      ACTIVATE_AGENT_VERSION_ROUTE.handler({
        ...context(),
        agentId: 'support-agent',
        versionId: versionIds.v2,
        expectedActiveVersionId: versionIds.v3,
      }),
    );

    expect(conflict).toEqual({
      status: 409,
      body: {
        error: {
          code: 'LABEL_MOVE_CONFLICT',
          message: 'Production changed after it was read.',
          details: {
            label: 'production',
            expectedActiveVersionId: versionIds.v3,
            currentActiveVersionId: versionIds.v1,
          },
        },
      },
    });
    const agents = await storage.getStore('agents');
    expect((await agents.getById('support-agent'))?.activeVersionId).toBe(versionIds.v1);
  });

  it('treats an already-active target as idempotent before checking a stale expectation', async () => {
    const agents = await storage.getStore('agents');
    const updateSpy = vi.spyOn(agents, 'update');

    await expect(
      ACTIVATE_AGENT_VERSION_ROUTE.handler({
        ...context(),
        agentId: 'support-agent',
        versionId: versionIds.v1,
        expectedActiveVersionId: versionIds.v3,
      }),
    ).resolves.toMatchObject({ success: true, activeVersionId: versionIds.v1 });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('serializes concurrent production CAS requests so only one observed target wins', async () => {
    const agents = await storage.getStore('agents');
    const originalUpdate = agents.update.bind(agents);
    let signalUpdateEntered!: () => void;
    const updateEntered = new Promise<void>(resolve => {
      signalUpdateEntered = resolve;
    });
    let releaseUpdate!: () => void;
    vi.spyOn(agents, 'update').mockImplementationOnce(async input => {
      signalUpdateEntered();
      await new Promise<void>(resolve => {
        releaseUpdate = resolve;
      });
      return originalUpdate(input);
    });

    const first = ACTIVATE_AGENT_VERSION_ROUTE.handler({
      ...context(),
      agentId: 'support-agent',
      versionId: versionIds.v2,
      expectedActiveVersionId: versionIds.v1,
    });
    await updateEntered;
    const second = readHttpError(
      ACTIVATE_AGENT_VERSION_ROUTE.handler({
        ...context(),
        agentId: 'support-agent',
        versionId: versionIds.v3,
        expectedActiveVersionId: versionIds.v1,
      }),
    );

    releaseUpdate();
    await expect(first).resolves.toMatchObject({ activeVersionId: versionIds.v2 });
    await expect(second).resolves.toMatchObject({
      status: 409,
      body: { error: { code: 'LABEL_MOVE_CONFLICT' } },
    });
    expect((await agents.getById('support-agent'))?.activeVersionId).toBe(versionIds.v2);
  });

  it('enriches a version page with deterministic computed and custom labels in one channel read', async () => {
    await SET_AGENT_VERSION_LABEL_ROUTE.handler({
      ...context(),
      agentId: 'support-agent',
      label: 'z-candidate',
      versionId: versionIds.v2,
      expectedRevisionToken: null,
    });
    await SET_AGENT_VERSION_LABEL_ROUTE.handler({
      ...context(),
      agentId: 'support-agent',
      label: 'a-candidate',
      versionId: versionIds.v3,
      expectedRevisionToken: null,
    });

    const agents = await storage.getStore('agents');
    const listLabels = vi.spyOn(agents.versionLabels!, 'list');
    const result = await LIST_AGENT_VERSIONS_ROUTE.handler({
      ...context(),
      agentId: 'support-agent',
      page: 0,
      perPage: 50,
    });

    expect(listLabels).toHaveBeenCalledTimes(1);
    expect(listLabels).toHaveBeenCalledWith({
      entityType: 'agent',
      entityId: 'support-agent',
      page: 0,
      perPage: false,
    });
    expect(result.versions.find(version => version.id === versionIds.v1)?.labels).toEqual(['production']);
    expect(result.versions.find(version => version.id === versionIds.v2)?.labels).toEqual(['z-candidate']);
    expect(result.versions.find(version => version.id === versionIds.v3)?.labels).toEqual(['latest', 'a-candidate']);
    expect(result.versions.every(version => Array.isArray(version.labels))).toBe(true);
  });

  it('returns computed-only labels when the custom-label channel is unavailable', async () => {
    const agents = await storage.getStore('agents');
    Object.defineProperty(agents, 'versionLabels', { value: undefined });

    const result = await LIST_AGENT_VERSIONS_ROUTE.handler({
      ...context(),
      agentId: 'support-agent',
      page: 0,
      perPage: 50,
    });

    expect(result.versions.find(version => version.id === versionIds.v1)?.labels).toEqual(['production']);
    expect(result.versions.find(version => version.id === versionIds.v2)?.labels).toEqual([]);
    expect(result.versions.find(version => version.id === versionIds.v3)?.labels).toEqual(['latest']);
  });

  it('returns computed-only labels when custom labels are unsupported for this agent', async () => {
    const agents = await storage.getStore('agents');
    vi.spyOn(agents.versionLabels!, 'list').mockRejectedValue(
      Object.assign(new Error('Version labels are unsupported'), { id: 'VERSION_LABELS_UNSUPPORTED' }),
    );

    const result = await LIST_AGENT_VERSIONS_ROUTE.handler({
      ...context(),
      agentId: 'support-agent',
      page: 0,
      perPage: 50,
    });

    expect(result.versions.find(version => version.id === versionIds.v1)?.labels).toEqual(['production']);
    expect(result.versions.find(version => version.id === versionIds.v2)?.labels).toEqual([]);
    expect(result.versions.find(version => version.id === versionIds.v3)?.labels).toEqual(['latest']);
  });

  it('maps labeled-version deletion protection to the public conflict envelope', async () => {
    await SET_AGENT_VERSION_LABEL_ROUTE.handler({
      ...context(),
      agentId: 'support-agent',
      label: 'candidate',
      versionId: versionIds.v2,
      expectedRevisionToken: null,
    });

    const blocked = await readHttpError(
      DELETE_AGENT_VERSION_ROUTE.handler({
        ...context(),
        agentId: 'support-agent',
        versionId: versionIds.v2,
      }),
    );

    expect(blocked).toMatchObject({
      status: 409,
      body: {
        error: {
          code: 'VERSION_IN_USE_BY_LABEL',
          details: { entityId: 'support-agent', versionId: versionIds.v2, labels: 'candidate' },
        },
      },
    });
  });

  it('masks scoped and private parents while honoring resource-scoped read and publish grants', async () => {
    const agents = await storage.getStore('agents');
    await agents.update({ id: 'support-agent', authorId: 'owner', visibility: 'private' });

    const outsider = context();
    outsider.requestContext.set(MASTRA_RESOURCE_ID_KEY, 'outsider');
    outsider.requestContext.set(MASTRA_USER_KEY, { id: 'outsider' });
    outsider.requestContext.set(MASTRA_USER_PERMISSIONS_KEY, ['stored-agents:read', 'stored-agents:publish']);

    await expect(
      readHttpError(
        LIST_AGENT_VERSIONS_ROUTE.handler({
          ...outsider,
          agentId: 'support-agent',
          page: 0,
          perPage: 50,
        }),
      ),
    ).resolves.toMatchObject({ status: 404, body: { error: { code: 'ENTITY_NOT_FOUND' } } });
    await expect(
      readHttpError(
        ACTIVATE_AGENT_VERSION_ROUTE.handler({
          ...outsider,
          agentId: 'support-agent',
          versionId: versionIds.v2,
          expectedActiveVersionId: versionIds.v1,
        }),
      ),
    ).resolves.toMatchObject({ status: 404, body: { error: { code: 'ENTITY_NOT_FOUND' } } });

    const delegated = context();
    delegated.requestContext.set(MASTRA_RESOURCE_ID_KEY, 'publisher');
    delegated.requestContext.set(MASTRA_USER_KEY, { id: 'publisher' });
    delegated.requestContext.set(MASTRA_USER_PERMISSIONS_KEY, [
      'stored-agents:read:support-agent',
      'stored-agents:publish:support-agent',
    ]);
    await expect(
      LIST_AGENT_VERSIONS_ROUTE.handler({
        ...delegated,
        agentId: 'support-agent',
        page: 0,
        perPage: 50,
      }),
    ).resolves.toMatchObject({ total: 3 });
    await expect(
      ACTIVATE_AGENT_VERSION_ROUTE.handler({
        ...delegated,
        agentId: 'support-agent',
        versionId: versionIds.v2,
        expectedActiveVersionId: versionIds.v1,
      }),
    ).resolves.toMatchObject({ activeVersionId: versionIds.v2 });

    await agents.update({ id: 'support-agent', metadata: { 'mastra.resourceId': 'tenant-a' } });
    const scopedContext = context();
    scopedContext.requestContext.set(MASTRA_RESOURCE_ID_KEY, 'tenant-b');
    const scopedMastra = {
      getStorage: () => storage,
      getEditor: () => undefined,
      getServer: () => ({ storedResources: { scope: true } }),
      getAgentById: () => {
        throw new Error('not code-defined');
      },
    } as unknown as Mastra;
    await expect(
      readHttpError(
        LIST_AGENT_VERSIONS_ROUTE.handler({
          ...scopedContext,
          mastra: scopedMastra,
          agentId: 'support-agent',
          page: 0,
          perPage: 50,
        }),
      ),
    ).resolves.toMatchObject({ status: 404, body: { error: { code: 'ENTITY_NOT_FOUND' } } });
    await expect(
      readHttpError(
        ACTIVATE_AGENT_VERSION_ROUTE.handler({
          ...scopedContext,
          mastra: scopedMastra,
          agentId: 'support-agent',
          versionId: versionIds.v3,
          expectedActiveVersionId: versionIds.v2,
        }),
      ),
    ).resolves.toMatchObject({ status: 404, body: { error: { code: 'ENTITY_NOT_FOUND' } } });
    expect((await agents.getById('support-agent'))?.activeVersionId).toBe(versionIds.v2);
  });
});
