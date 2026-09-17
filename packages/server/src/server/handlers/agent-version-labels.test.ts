import { Mastra } from '@mastra/core';
import { createVersionLabelError, InMemoryStore } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';

import { MASTRA_RESOURCE_ID_KEY, MASTRA_USER_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import { listAgentVersionLabelsQuerySchema } from '../schemas/agent-version-labels';

import {
  DELETE_AGENT_VERSION_LABEL_ROUTE,
  LIST_AGENT_VERSION_LABELS_ROUTE,
  SET_AGENT_VERSION_LABEL_ROUTE,
} from './agent-version-labels';
import { createTestServerContext } from './test-utils';
import { handleVersionLabelError } from './version-label-errors';

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

async function readMappedStorageError(error: Error) {
  let mapped: HTTPException | undefined;
  try {
    handleVersionLabelError(error, 'fallback');
  } catch (caught) {
    mapped = caught as HTTPException;
  }
  expect(mapped).toBeInstanceOf(HTTPException);
  const response = mapped!.getResponse();
  return { status: response.status, body: await response.json() };
}

describe('agent version label handlers', () => {
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
    const v1 = await agents.getLatestVersion('support-agent');
    if (!v1) throw new Error('Expected initial version');

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
    await agents.update({ id: 'support-agent', activeVersionId: v1.id, status: 'published' });
    versionIds = { v1: v1.id, v2: 'support-v2', v3: 'support-v3' };
  });

  function context() {
    return createTestServerContext({ mastra });
  }

  it('maps label routes onto existing read and publish permissions', () => {
    expect(LIST_AGENT_VERSION_LABELS_ROUTE.requiresPermission).toBe('stored-agents:read');
    expect(SET_AGENT_VERSION_LABEL_ROUTE.requiresPermission).toBe('stored-agents:publish');
    expect(DELETE_AGENT_VERSION_LABEL_ROUTE.requiresPermission).toBe('stored-agents:publish');
  });

  it('lists production, latest, and lexically ordered custom labels in one virtual pagination space', async () => {
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

    const firstPage = await LIST_AGENT_VERSION_LABELS_ROUTE.handler({
      ...context(),
      agentId: 'support-agent',
      page: 0,
      perPage: 2,
    });
    expect(firstPage).toEqual({
      labels: [
        {
          name: 'production',
          kind: 'production',
          versionId: versionIds.v1,
          versionNumber: 1,
        },
        { name: 'latest', kind: 'latest', versionId: versionIds.v3, versionNumber: 3 },
      ],
      pagination: { total: 4, page: 0, perPage: 2, hasMore: true },
    });

    const secondPage = await LIST_AGENT_VERSION_LABELS_ROUTE.handler({
      ...context(),
      agentId: 'support-agent',
      page: 1,
      perPage: 2,
    });
    expect(secondPage.labels.map(label => label.name)).toEqual(['a-candidate', 'z-candidate']);
    expect(secondPage.labels.every(label => label.kind === 'custom' && !!label.revisionToken)).toBe(true);
    expect(secondPage.pagination).toEqual({ total: 4, page: 1, perPage: 2, hasMore: false });
  });

  it('creates and moves a label with CAS, preserving conflict details in the public envelope', async () => {
    const created = await SET_AGENT_VERSION_LABEL_ROUTE.handler({
      ...context(),
      agentId: 'support-agent',
      label: 'pr-101',
      versionId: versionIds.v3,
      expectedRevisionToken: null,
    });
    expect(created).toMatchObject({
      name: 'pr-101',
      kind: 'custom',
      versionId: versionIds.v3,
      versionNumber: 3,
    });

    const moved = await SET_AGENT_VERSION_LABEL_ROUTE.handler({
      ...context(),
      agentId: 'support-agent',
      label: 'pr-101',
      versionId: versionIds.v2,
      expectedRevisionToken: created.revisionToken!,
    });
    expect(moved.versionId).toBe(versionIds.v2);
    expect(moved.revisionToken).not.toBe(created.revisionToken);

    const conflict = await readHttpError(
      SET_AGENT_VERSION_LABEL_ROUTE.handler({
        ...context(),
        agentId: 'support-agent',
        label: 'pr-101',
        versionId: versionIds.v3,
        expectedRevisionToken: created.revisionToken!,
      }),
    );
    expect(conflict).toMatchObject({
      status: 409,
      body: {
        error: {
          code: 'LABEL_MOVE_CONFLICT',
          details: {
            currentVersionId: versionIds.v2,
            currentRevisionToken: moved.revisionToken,
          },
        },
      },
    });
  });

  it('deletes with CAS and makes an already-successful retry idempotent', async () => {
    const created = await SET_AGENT_VERSION_LABEL_ROUTE.handler({
      ...context(),
      agentId: 'support-agent',
      label: 'temporary',
      versionId: versionIds.v3,
      expectedRevisionToken: null,
    });

    await expect(
      DELETE_AGENT_VERSION_LABEL_ROUTE.handler({
        ...context(),
        agentId: 'support-agent',
        label: 'temporary',
        expectedRevisionToken: 'stale-token',
      }),
    ).rejects.toMatchObject({ status: 409 });

    await expect(
      DELETE_AGENT_VERSION_LABEL_ROUTE.handler({
        ...context(),
        agentId: 'support-agent',
        label: 'temporary',
        expectedRevisionToken: created.revisionToken!,
      }),
    ).resolves.toEqual({ success: true, deleted: true });
    await expect(
      DELETE_AGENT_VERSION_LABEL_ROUTE.handler({
        ...context(),
        agentId: 'support-agent',
        label: 'temporary',
        expectedRevisionToken: created.revisionToken!,
      }),
    ).resolves.toEqual({ success: true, deleted: false });
  });

  it.each([
    ['Uppercase', 'INVALID_LABEL', 400],
    ['production', 'RESERVED_LABEL', 400],
    ['latest', 'RESERVED_LABEL', 400],
  ])('returns a stable public error for invalid mutation label %s', async (label, code, status) => {
    const error = await readHttpError(
      SET_AGENT_VERSION_LABEL_ROUTE.handler({
        ...context(),
        agentId: 'support-agent',
        label,
        versionId: versionIds.v3,
        expectedRevisionToken: null,
      }),
    );
    expect(error).toMatchObject({ status, body: { error: { code } } });
  });

  it('masks missing, inaccessible, and foreign parent resources', async () => {
    const missing = await readHttpError(
      LIST_AGENT_VERSION_LABELS_ROUTE.handler({
        ...context(),
        agentId: 'missing-agent',
        page: 0,
        perPage: 50,
      }),
    );
    expect(missing).toMatchObject({ status: 404, body: { error: { code: 'ENTITY_NOT_FOUND' } } });

    const agents = await storage.getStore('agents');
    await agents.create({
      agent: {
        id: 'foreign-agent',
        name: 'Foreign agent',
        instructions: 'Foreign',
        model: { provider: 'openai', name: 'gpt-5.5' },
      },
    });
    const foreignVersion = await agents.getLatestVersion('foreign-agent');
    if (!foreignVersion) throw new Error('Expected foreign version');
    const foreign = await readHttpError(
      SET_AGENT_VERSION_LABEL_ROUTE.handler({
        ...context(),
        agentId: 'support-agent',
        label: 'candidate',
        versionId: foreignVersion.id,
        expectedRevisionToken: null,
      }),
    );
    expect(foreign).toMatchObject({ status: 404, body: { error: { code: 'VERSION_NOT_FOUND' } } });

    await agents.update({ id: 'support-agent', metadata: { 'mastra.resourceId': 'tenant-a' } });
    const scopedContext = context();
    scopedContext.requestContext.set(MASTRA_RESOURCE_ID_KEY, 'tenant-b');
    const scopedMastra = {
      getStorage: () => storage,
      getEditor: () => undefined,
      getServer: () => ({ storedResources: { scope: true } }),
    } as unknown as Mastra;
    const inaccessible = await readHttpError(
      LIST_AGENT_VERSION_LABELS_ROUTE.handler({
        ...scopedContext,
        mastra: scopedMastra,
        agentId: 'support-agent',
        page: 0,
        perPage: 50,
      }),
    );
    expect(inaccessible).toMatchObject({ status: 404, body: { error: { code: 'ENTITY_NOT_FOUND' } } });
  });

  it('masks private agents from non-owners even when they hold broad route permissions', async () => {
    const agents = await storage.getStore('agents');
    await agents.update({ id: 'support-agent', authorId: 'owner', visibility: 'private' });
    const outsiderContext = context();
    outsiderContext.requestContext.set(MASTRA_RESOURCE_ID_KEY, 'outsider');
    outsiderContext.requestContext.set(MASTRA_USER_KEY, { id: 'outsider' });
    outsiderContext.requestContext.set(MASTRA_USER_PERMISSIONS_KEY, ['stored-agents:read', 'stored-agents:publish']);

    const readError = await readHttpError(
      LIST_AGENT_VERSION_LABELS_ROUTE.handler({
        ...outsiderContext,
        agentId: 'support-agent',
        page: 0,
        perPage: 50,
      }),
    );
    expect(readError).toMatchObject({ status: 404, body: { error: { code: 'ENTITY_NOT_FOUND' } } });

    const publishError = await readHttpError(
      SET_AGENT_VERSION_LABEL_ROUTE.handler({
        ...outsiderContext,
        agentId: 'support-agent',
        label: 'candidate',
        versionId: versionIds.v3,
        expectedRevisionToken: null,
      }),
    );
    expect(publishError).toMatchObject({ status: 404, body: { error: { code: 'ENTITY_NOT_FOUND' } } });
  });

  it('allows a resource-scoped stored-agents:publish grant to move a private agent label', async () => {
    const agents = await storage.getStore('agents');
    await agents.update({ id: 'support-agent', authorId: 'owner', visibility: 'private' });
    const publisherContext = context();
    publisherContext.requestContext.set(MASTRA_RESOURCE_ID_KEY, 'publisher');
    publisherContext.requestContext.set(MASTRA_USER_KEY, { id: 'publisher' });
    publisherContext.requestContext.set(MASTRA_USER_PERMISSIONS_KEY, [
      'stored-agents:publish',
      'stored-agents:publish:support-agent',
    ]);

    await expect(
      SET_AGENT_VERSION_LABEL_ROUTE.handler({
        ...publisherContext,
        agentId: 'support-agent',
        label: 'candidate',
        versionId: versionIds.v3,
        expectedRevisionToken: null,
      }),
    ).resolves.toMatchObject({ name: 'candidate', versionId: versionIds.v3 });
  });

  it('returns VERSION_LABELS_UNSUPPORTED when the agents domain has no label channel', async () => {
    const unsupportedMastra = {
      getStorage: () => ({
        getStore: async () => ({
          getById: async () => ({ metadata: undefined }),
          getVersion: async () => null,
          listVersions: async () => ({ versions: [] }),
        }),
      }),
      getEditor: () => undefined,
      getServer: () => undefined,
    } as unknown as Mastra;

    const error = await readHttpError(
      LIST_AGENT_VERSION_LABELS_ROUTE.handler({
        ...createTestServerContext({ mastra: unsupportedMastra }),
        agentId: 'support-agent',
        page: 0,
        perPage: 50,
      }),
    );
    expect(error).toMatchObject({ status: 501, body: { error: { code: 'VERSION_LABELS_UNSUPPORTED' } } });
  });

  it('fails closed when the computed production pointer is dangling', async () => {
    const agents = await storage.getStore('agents');
    await agents.update({ id: 'support-agent', activeVersionId: 'missing-production-version' });

    const error = await readHttpError(
      LIST_AGENT_VERSION_LABELS_ROUTE.handler({
        ...context(),
        agentId: 'support-agent',
        page: 0,
        perPage: 50,
      }),
    );
    expect(error).toMatchObject({
      status: 500,
      body: {
        error: {
          code: 'VERSION_LABEL_INTEGRITY_ERROR',
          details: { label: 'production', versionId: 'missing-production-version' },
        },
      },
    });
  });

  it('coerces zero-based pagination and rejects malformed values at the schema boundary', () => {
    expect(listAgentVersionLabelsQuerySchema.parse({ page: '1', perPage: '25' })).toEqual({ page: 1, perPage: 25 });
    expect(listAgentVersionLabelsQuerySchema.safeParse({ page: '-1' }).success).toBe(false);
    expect(listAgentVersionLabelsQuerySchema.safeParse({ perPage: '2.5' }).success).toBe(false);
  });
});

describe('version label public error mapping', () => {
  it.each([
    ['INVALID_VERSION_LABEL', 'INVALID_LABEL', 400],
    ['RESERVED_VERSION_LABEL', 'RESERVED_LABEL', 400],
    ['VERSION_LABEL_NOT_FOUND', 'LABEL_NOT_FOUND', 404],
    ['VERSION_LABEL_CONFLICT', 'LABEL_MOVE_CONFLICT', 409],
    ['VERSION_NOT_OWNED_BY_ENTITY', 'VERSION_NOT_FOUND', 404],
    ['VERSION_IN_USE_BY_LABEL', 'VERSION_IN_USE_BY_LABEL', 409],
    ['VERSION_LABEL_INTEGRITY_ERROR', 'VERSION_LABEL_INTEGRITY_ERROR', 500],
    ['VERSION_LABELS_UNSUPPORTED', 'VERSION_LABELS_UNSUPPORTED', 501],
  ] as const)('maps %s to %s', async (storageCode, apiCode, status) => {
    const result = await readMappedStorageError(createVersionLabelError(storageCode, { label: 'candidate' }));
    expect(result).toMatchObject({
      status,
      body: { error: { code: apiCode, details: { label: 'candidate' } } },
    });
  });

  it('does not expose the actual owner of a foreign version', async () => {
    const result = await readMappedStorageError(
      createVersionLabelError('VERSION_NOT_OWNED_BY_ENTITY', {
        entityId: 'visible-agent',
        versionId: 'foreign-version',
        versionEntityId: 'private-agent',
      }),
    );

    expect(result).toEqual({
      status: 404,
      body: {
        error: {
          code: 'VERSION_NOT_FOUND',
          message: 'The requested version was not found.',
          details: { entityId: 'visible-agent', versionId: 'foreign-version' },
        },
      },
    });
  });

  it('maps an empty computed latest selector to LABEL_NOT_FOUND', async () => {
    const result = await readMappedStorageError(
      createVersionLabelError('VERSION_NOT_FOUND', { entityId: 'empty-agent', label: 'latest' }),
    );

    expect(result).toEqual({
      status: 404,
      body: {
        error: {
          code: 'LABEL_NOT_FOUND',
          message: 'The version label was not found.',
          details: { entityId: 'empty-agent', label: 'latest' },
        },
      },
    });
  });
});
