import { MASTRA_VERSIONS_KEY } from '@mastra/core/di';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import { agentVersionOverridesSchema, executeAgentToolBodySchema } from '../schemas/agents';
import { createResponseBodySchema } from '../schemas/responses';
import { A2A_ROUTES } from '../server-adapter/routes/a2a';
import { AGENT_CONTROLLER_ROUTES } from '../server-adapter/routes/agent-controller';
import { AGENTS_ROUTES } from '../server-adapter/routes/agents';
import { CONVERSATIONS_ROUTES } from '../server-adapter/routes/conversations';
import { DATASETS_ROUTES } from '../server-adapter/routes/datasets';
import { LEGACY_ROUTES } from '../server-adapter/routes/legacy';
import { RESPONSES_ROUTES } from '../server-adapter/routes/responses';
import { SCORES_ROUTES } from '../server-adapter/routes/scorers';
import { STORED_AGENTS_ROUTES } from '../server-adapter/routes/stored-agents';

import { AGENT_VERSION_ROUTE_MATRIX } from './agent-version-route-matrix';
import {
  APPROVE_NETWORK_TOOL_CALL_ROUTE,
  NETWORK_CONTINUATION_WORKFLOW_NAMES,
  getAgentForContinuation,
  normalizeVersionOverrides,
  resolveContinuationVersioning,
} from './agents';
import { handleVersionLabelError } from './version-label-errors';

const key = ({ method, path }: { method: string; path: string }) => `${method} ${path}`;

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

function createWorkflowMastra(rows: Record<string, { snapshot: unknown } | undefined>) {
  const getWorkflowRunById = vi.fn(async ({ workflowName }: { workflowName: string; runId: string }) => {
    return rows[workflowName] ?? null;
  });
  return {
    mastra: {
      getStorage: vi.fn(() => ({
        getStore: vi.fn(async () => ({ getWorkflowRunById })),
      })),
    } as never,
    getWorkflowRunById,
  };
}

const pinnedSnapshot = (versionId: string, agents?: Record<string, { agentId: string; versionId: string }>) => ({
  status: 'suspended',
  requestContext: {
    mastra__agentVersionPins: {
      root: { agentId: 'stored-agent', versionId, selectedLabel: 'candidate' },
      ...(agents ? { agents } : {}),
    },
  },
});

describe('agent version route matrix', () => {
  it('is unique and inventories every public agent, A2A, Responses, conversation, and score route', () => {
    const inventoryKeys = AGENT_VERSION_ROUTE_MATRIX.map(key);
    expect(new Set(inventoryKeys).size).toBe(inventoryKeys.length);

    const requiredRoutes = [
      ...AGENTS_ROUTES,
      ...LEGACY_ROUTES.filter(route => route.path.startsWith('/agents/')),
      ...A2A_ROUTES,
      ...AGENT_CONTROLLER_ROUTES,
      ...RESPONSES_ROUTES,
      ...CONVERSATIONS_ROUTES,
      ...SCORES_ROUTES,
      ...DATASETS_ROUTES.filter(
        route => route.method === 'POST' && route.path === '/datasets/:datasetId/experiments',
      ),
      ...STORED_AGENTS_ROUTES.filter(
        route => route.method === 'GET' && route.path === '/stored/agents/:storedAgentId',
      ),
    ];
    const inventory = new Set(inventoryKeys);
    expect(requiredRoutes.map(key).filter(routeKey => !inventory.has(routeKey))).toEqual([]);
  });

  it('requires shared selection for resolved reads/new runs and persisted pins for continuations', () => {
    for (const entry of AGENT_VERSION_ROUTE_MATRIX) {
      if (entry.modes.includes('resolved-read') || entry.modes.includes('new-execution')) {
        expect(['query-selector', 'body-selector', 'selector-and-persisted-pin']).toContain(entry.policy);
      }
      if (entry.modes.includes('continuation')) {
        expect(['persisted-pin', 'selector-and-persisted-pin', 'core-owned']).toContain(entry.policy);
      }
    }

    expect(
      AGENT_VERSION_ROUTE_MATRIX.find(entry => entry.path === '/agents/:agentId/send-tool-approval'),
    ).toMatchObject({
      modes: ['continuation'],
      policy: 'selector-and-persisted-pin',
      note: expect.stringContaining('cross-process'),
    });
  });

  it('keeps query-selector routes wired to the canonical selector schema', () => {
    const routes = new Map(AGENTS_ROUTES.map(route => [key(route), route]));
    for (const route of A2A_ROUTES) routes.set(key(route), route);
    for (const route of STORED_AGENTS_ROUTES) routes.set(key(route), route);

    for (const entry of AGENT_VERSION_ROUTE_MATRIX.filter(entry => entry.policy === 'query-selector')) {
      const publicRoute = routes.get(key(entry));
      expect(publicRoute, key(entry)).toBeDefined();
      expect(publicRoute!.queryParamSchema, key(entry)).toBeDefined();
      const routeSpecificQuery = entry.path === '/agents/:agentId/plans/file' ? { path: '.mastracode/plans/a.md' } : {};
      expect(
        publicRoute!.queryParamSchema!.safeParse({ ...routeSpecificQuery, label: 'candidate' }).success,
        key(entry),
      ).toBe(true);
    }
  });

  it('uses the canonical body selector shape for tools and Responses', () => {
    expect(agentVersionOverridesSchema.safeParse({ self: { label: 'candidate' } }).success).toBe(true);
    expect(executeAgentToolBodySchema.safeParse({ data: {}, versions: { self: { label: 'candidate' } } }).success).toBe(
      true,
    );
    expect(
      createResponseBodySchema.safeParse({
        agent_id: 'stored-agent',
        input: 'hello',
        versions: { self: { label: 'candidate' } },
      }).success,
    ).toBe(true);

    for (const path of [
      '/agent-controller/:controllerId/sessions/:resourceId/messages',
      '/agent-controller/:controllerId/sessions/:resourceId/steer',
      '/agent-controller/:controllerId/sessions/:resourceId/follow-up',
      '/agent-controller/:controllerId/sessions/:resourceId/notifications',
    ]) {
      const route = AGENT_CONTROLLER_ROUTES.find(route => route.path === path);
      expect(route?.bodySchema, path).toBeDefined();
      const requiredBody = path.endsWith('/notifications')
        ? { source: 'build', kind: 'finished', summary: 'done' }
        : { message: 'hello' };
      expect(
        route!.bodySchema!.safeParse({ ...requiredBody, versions: { self: { label: 'candidate' } } }).success,
        path,
      ).toBe(true);
    }
  });
});

describe('continuation version reconciliation', () => {
  it('canonicalizes empty override payloads away', () => {
    expect(normalizeVersionOverrides({})).toBeUndefined();
    expect(normalizeVersionOverrides({ agents: {} })).toBeUndefined();
  });

  it('rejects an invalid default status from RequestContext with the public envelope', async () => {
    const { mastra, getWorkflowRunById } = createWorkflowMastra({});
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_VERSIONS_KEY, { defaultStatus: 'archived' });

    const error = await readHttpError(
      resolveContinuationVersioning({
        mastra,
        agentId: 'stored-agent',
        runId: 'run-1',
        requestContext,
      }),
    );
    expect(error).toEqual({
      status: 400,
      body: {
        error: {
          code: 'INVALID_VERSION_SELECTOR',
          message: 'defaultStatus must be draft or published',
          details: { source: 'requestContext.mastra__versions.defaultStatus' },
        },
      },
    });
    expect(getWorkflowRunById).not.toHaveBeenCalled();
  });

  it.each([
    ['label', { self: { label: 'candidate' } }],
    ['status', { self: { status: 'published' as const } }],
  ])('rejects a mutable %s root selector before loading a run', async (_kind, versions) => {
    const { mastra, getWorkflowRunById } = createWorkflowMastra({});
    const error = await readHttpError(
      resolveContinuationVersioning({ mastra, agentId: 'stored-agent', runId: 'run-1', versions }),
    );
    expect(error).toEqual({
      status: 400,
      body: {
        error: {
          code: 'INVALID_VERSION_SELECTOR',
          message: 'Continuation root selectors must use an immutable versionId',
          details: { source: 'versions.self' },
        },
      },
    });
    expect(getWorkflowRunById).not.toHaveBeenCalled();
  });

  it('accepts the same exact pin and hydrates an omitted selector from that pin', async () => {
    const { mastra } = createWorkflowMastra({ 'agentic-loop': { snapshot: pinnedSnapshot('version-1') } });

    await expect(
      resolveContinuationVersioning({
        mastra,
        agentId: 'stored-agent',
        runId: 'run-1',
        versions: {
          self: { versionId: 'version-1' },
          agents: { 'stored-agent': { versionId: 'version-1' } },
        },
      }),
    ).resolves.toMatchObject({ versionOptions: { versionId: 'version-1' }, delegatedVersions: undefined });
    await expect(
      resolveContinuationVersioning({ mastra, agentId: 'stored-agent', runId: 'run-1' }),
    ).resolves.toMatchObject({ versionOptions: { versionId: 'version-1' } });
  });

  it('limits the legacy no-pin bridge to an exact root selector', async () => {
    const { mastra } = createWorkflowMastra({});

    await expect(
      resolveContinuationVersioning({
        mastra,
        agentId: 'stored-agent',
        runId: 'legacy-run',
        versions: { self: { versionId: 'root-v1' } },
      }),
    ).resolves.toMatchObject({
      versionOptions: { versionId: 'root-v1' },
      hasStructuredPins: false,
    });

    for (const versions of [
      { agents: { dependency: { versionId: 'dependency-v1' } } },
      { defaultStatus: 'draft' as const },
    ]) {
      const error = await readHttpError(
        resolveContinuationVersioning({
          mastra,
          agentId: 'stored-agent',
          runId: 'legacy-run',
          versions,
        }),
      );
      expect(error).toMatchObject({
        status: 400,
        body: { error: { code: 'INVALID_VERSION_SELECTOR' } },
      });
    }
  });

  it('rejects a different exact selector with the public pinned conflict envelope', async () => {
    const { mastra } = createWorkflowMastra({ 'agentic-loop': { snapshot: pinnedSnapshot('version-1') } });
    const error = await readHttpError(
      resolveContinuationVersioning({
        mastra,
        agentId: 'stored-agent',
        runId: 'run-1',
        versions: { self: { versionId: 'version-2' } },
      }),
    );
    expect(error).toEqual({
      status: 409,
      body: {
        error: {
          code: 'PINNED_VERSION_CONFLICT',
          message: 'The continuation version does not match the persisted run version.',
          details: {
            agentId: 'stored-agent',
            runId: 'run-1',
            pinnedVersionId: 'version-1',
            requestedVersionId: 'version-2',
          },
        },
      },
    });
  });

  it('rejects disagreeing continuation root sources before loading the run', async () => {
    const { mastra, getWorkflowRunById } = createWorkflowMastra({});
    const error = await readHttpError(
      resolveContinuationVersioning({
        mastra,
        agentId: 'stored-agent',
        runId: 'run-1',
        versions: {
          self: { versionId: 'version-1' },
          agents: { 'stored-agent': { versionId: 'version-2' } },
        },
      }),
    );
    expect(error).toEqual({
      status: 400,
      body: {
        error: {
          code: 'INVALID_VERSION_SELECTOR',
          message: 'Version selector sources disagree',
          details: { sources: ['versions.self', 'versions.agents.stored-agent'] },
        },
      },
    });
    expect(getWorkflowRunById).not.toHaveBeenCalled();
  });

  it('keeps a structured unversioned root authoritative over legacy root fields', async () => {
    const { mastra } = createWorkflowMastra({
      'agentic-loop': {
        snapshot: {
          requestContext: {
            mastra__agentVersionPins: {
              agents: { dependency: { agentId: 'dependency', versionId: 'dependency-v1' } },
            },
            __agentId: 'stored-agent',
            __agentVersionId: 'legacy-root-v1',
          },
        },
      },
    });
    await expect(
      resolveContinuationVersioning({ mastra, agentId: 'stored-agent', runId: 'run-1' }),
    ).resolves.toMatchObject({ versionOptions: undefined, hasStructuredPins: true });
    const error = await readHttpError(
      resolveContinuationVersioning({
        mastra,
        agentId: 'stored-agent',
        runId: 'run-1',
        versions: { self: { versionId: 'version-1' } },
      }),
    );
    expect(error).toEqual({
      status: 409,
      body: {
        error: {
          code: 'PINNED_VERSION_CONFLICT',
          message: 'The continuation version does not match the persisted unversioned run.',
          details: { agentId: 'stored-agent', runId: 'run-1', requestedVersionId: 'version-1' },
        },
      },
    });
  });

  it('forwards a rootless structured draft default without injecting legacy published', async () => {
    const { mastra } = createWorkflowMastra({
      'agentic-loop': {
        snapshot: {
          requestContext: {
            mastra__agentVersionPins: { defaultStatus: 'draft' },
          },
        },
      },
    });

    await expect(
      resolveContinuationVersioning({ mastra, agentId: 'stored-agent', runId: 'run-1' }),
    ).resolves.toMatchObject({
      versionOptions: undefined,
      delegatedVersions: { defaultStatus: 'draft' },
      hasStructuredPins: true,
    });
    await expect(
      resolveContinuationVersioning({
        mastra,
        agentId: 'stored-agent',
        runId: 'run-1',
        versions: { defaultStatus: 'draft' },
      }),
    ).resolves.toMatchObject({ delegatedVersions: { defaultStatus: 'draft' } });

    const mismatch = await readHttpError(
      resolveContinuationVersioning({
        mastra,
        agentId: 'stored-agent',
        runId: 'run-1',
        versions: { defaultStatus: 'published' },
      }),
    );
    expect(mismatch).toMatchObject({
      status: 409,
      body: {
        error: {
          code: 'PINNED_VERSION_CONFLICT',
          details: { pinnedDefaultStatus: 'draft', requestedDefaultStatus: 'published' },
        },
      },
    });
  });

  it('hydrates a rootless structured continuation from the registered base agent', async () => {
    const { mastra } = createWorkflowMastra({
      'agentic-loop': {
        snapshot: {
          requestContext: {
            mastra__agentVersionPins: {
              agents: { dependency: { agentId: 'dependency', versionId: 'dependency-v1' } },
              defaultStatus: 'draft',
            },
          },
        },
      },
    });
    const baseAgent = { id: 'stored-agent' };
    const getEditor = vi.fn(() => ({
      agent: { applyStoredOverrides: vi.fn(() => ({ id: 'mutable-stored-default' })) },
    }));
    Object.assign(mastra as object, {
      getLogger: vi.fn(() => ({ debug: vi.fn() })),
      getAgentById: vi.fn(() => baseAgent),
      listAgents: vi.fn(() => ({})),
      getEditor,
    });
    const requestContext = new RequestContext();

    const result = await getAgentForContinuation({
      mastra,
      agentId: 'stored-agent',
      runId: 'run-1',
      requestContext,
    });

    expect(result.agent).toBe(baseAgent);
    expect(getEditor).not.toHaveBeenCalled();
    expect(requestContext.get(MASTRA_VERSIONS_KEY)).toEqual({
      agents: { dependency: { versionId: 'dependency-v1' } },
      defaultStatus: 'draft',
    });
  });

  it('loads network continuations from the network workflow row', async () => {
    const { mastra, getWorkflowRunById } = createWorkflowMastra({
      'agent-loop-main-workflow': { snapshot: pinnedSnapshot('network-version') },
    });
    await expect(
      resolveContinuationVersioning({
        mastra,
        agentId: 'stored-agent',
        runId: 'network-run',
        workflowNames: NETWORK_CONTINUATION_WORKFLOW_NAMES,
      }),
    ).resolves.toMatchObject({ versionOptions: { versionId: 'network-version' } });
    expect(getWorkflowRunById).toHaveBeenCalledTimes(1);
    expect(getWorkflowRunById).toHaveBeenCalledWith({
      workflowName: 'agent-loop-main-workflow',
      runId: 'network-run',
    });
  });

  it('reconciles network dependency assertions against persisted exact pins', async () => {
    const { mastra } = createWorkflowMastra({
      'agent-loop-main-workflow': {
        snapshot: pinnedSnapshot('network-version', {
          dependency: { agentId: 'dependency', versionId: 'dependency-v1' },
        }),
      },
    });

    await expect(
      resolveContinuationVersioning({
        mastra,
        agentId: 'stored-agent',
        runId: 'network-run',
        workflowNames: NETWORK_CONTINUATION_WORKFLOW_NAMES,
        versions: { agents: { dependency: { versionId: 'dependency-v1' } } },
      }),
    ).resolves.toMatchObject({
      delegatedVersions: { agents: { dependency: { versionId: 'dependency-v1' } } },
    });

    const mismatch = await readHttpError(
      resolveContinuationVersioning({
        mastra,
        agentId: 'stored-agent',
        runId: 'network-run',
        workflowNames: NETWORK_CONTINUATION_WORKFLOW_NAMES,
        versions: { agents: { dependency: { versionId: 'dependency-v2' } } },
      }),
    );
    expect(mismatch).toEqual({
      status: 409,
      body: {
        error: {
          code: 'PINNED_VERSION_CONFLICT',
          message: 'The continuation dependency version does not match the persisted run version.',
          details: {
            agentId: 'dependency',
            runId: 'network-run',
            pinnedVersionId: 'dependency-v1',
            requestedVersionId: 'dependency-v2',
          },
        },
      },
    });

    const routeMismatch = await readHttpError(
      APPROVE_NETWORK_TOOL_CALL_ROUTE.handler({
        mastra,
        agentId: 'stored-agent',
        runId: 'network-run',
        versions: { agents: { dependency: { versionId: 'dependency-v2' } } },
      } as never),
    );
    expect(routeMismatch).toMatchObject({
      status: 409,
      body: {
        error: {
          code: 'PINNED_VERSION_CONFLICT',
          details: { agentId: 'dependency', pinnedVersionId: 'dependency-v1', requestedVersionId: 'dependency-v2' },
        },
      },
    });

    const unpinned = await readHttpError(
      resolveContinuationVersioning({
        mastra,
        agentId: 'stored-agent',
        runId: 'network-run',
        workflowNames: NETWORK_CONTINUATION_WORKFLOW_NAMES,
        versions: { agents: { unpinned: { versionId: 'dependency-v1' } } },
      }),
    );
    expect(unpinned).toMatchObject({
      status: 409,
      body: { error: { code: 'PINNED_VERSION_CONFLICT', details: { agentId: 'unpinned' } } },
    });

    const matchingContext = new RequestContext();
    matchingContext.set(MASTRA_VERSIONS_KEY, {
      agents: { dependency: { versionId: 'dependency-v1' } },
    });
    await expect(
      resolveContinuationVersioning({
        mastra,
        agentId: 'stored-agent',
        runId: 'network-run',
        workflowNames: NETWORK_CONTINUATION_WORKFLOW_NAMES,
        requestContext: matchingContext,
      }),
    ).resolves.toMatchObject({
      delegatedVersions: { agents: { dependency: { versionId: 'dependency-v1' } } },
    });

    const poisonedContext = new RequestContext();
    poisonedContext.set(MASTRA_VERSIONS_KEY, {
      agents: { unpinned: { versionId: 'dependency-v1' } },
    });
    const contextMismatch = await readHttpError(
      resolveContinuationVersioning({
        mastra,
        agentId: 'stored-agent',
        runId: 'network-run',
        workflowNames: NETWORK_CONTINUATION_WORKFLOW_NAMES,
        requestContext: poisonedContext,
      }),
    );
    expect(contextMismatch).toMatchObject({
      status: 409,
      body: { error: { code: 'PINNED_VERSION_CONFLICT', details: { agentId: 'unpinned' } } },
    });
  });

  it('maps a core PINNED_VERSION_CONFLICT through the public envelope', async () => {
    const coreError = Object.assign(new Error('Pinned version changed.'), {
      id: 'PINNED_VERSION_CONFLICT',
      details: { agentId: 'stored-agent', pinnedVersionId: 'version-1', requestedVersionId: 'version-2' },
    });
    const error = await readHttpError(
      Promise.resolve().then(() => handleVersionLabelError(coreError, 'Error resuming agent')),
    );
    expect(error).toEqual({
      status: 409,
      body: {
        error: {
          code: 'PINNED_VERSION_CONFLICT',
          message: 'Pinned version changed.',
          details: { agentId: 'stored-agent', pinnedVersionId: 'version-1', requestedVersionId: 'version-2' },
        },
      },
    });
  });

  it.each([
    ['INVALID_VERSION_SELECTOR', 'INVALID_VERSION_SELECTOR', 400],
    ['PINNED_VERSION_REQUIRED', 'INVALID_VERSION_SELECTOR', 400],
    ['PINNED_VERSION_INVALID', 'VERSION_LABEL_INTEGRITY_ERROR', 500],
  ] as const)('maps core %s through a public continuation route', async (id, code, status) => {
    const coreError = Object.assign(new Error(`Core ${id} error.`), {
      id,
      details: { agentId: 'stored-agent', runId: 'legacy-run' },
    });
    const agent = {
      approveNetworkToolCall: vi.fn(async () => {
        throw coreError;
      }),
    };
    const mastra = {
      getStorage: vi.fn(() => undefined),
      getLogger: vi.fn(() => ({ debug: vi.fn() })),
      getAgentById: vi.fn(() => agent),
      listAgents: vi.fn(() => ({})),
      getEditor: vi.fn(() => undefined),
    };

    const error = await readHttpError(
      APPROVE_NETWORK_TOOL_CALL_ROUTE.handler({
        mastra,
        agentId: 'stored-agent',
        runId: 'legacy-run',
      } as never),
    );
    expect(error).toEqual({
      status,
      body: {
        error: {
          code,
          message: `Core ${id} error.`,
          details: { agentId: 'stored-agent', runId: 'legacy-run' },
        },
      },
    });
  });
});
