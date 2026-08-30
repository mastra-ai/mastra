import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HTTPException } from '../http-exception';

import { SET_AGENT_VERSION_LABEL_ROUTE } from './agent-version-labels';
import { GENERATE_AGENT_ROUTE, GET_AGENT_BY_ID_ROUTE } from './agents';
import { GET_STORED_AGENT_ROUTE } from './stored-agents';
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

describe('agent version label runtime', () => {
  let storage: InMemoryStore;
  let mastra: Mastra;
  let versionIds: { v1: string; v2: string };
  let resolvedVersionIds: string[];
  let selectedLabels: string[];

  beforeEach(async () => {
    storage = new InMemoryStore();
    mastra = new Mastra({ logger: false, storage });

    const agents = await storage.getStore('agents');
    await agents.create({
      agent: {
        id: 'runtime-agent',
        name: 'Runtime agent',
        instructions: 'version-one',
        model: { provider: 'openai', name: 'gpt-5.5' },
      },
    });
    const first = await agents.getLatestVersion('runtime-agent');
    if (!first) throw new Error('Expected initial version');
    await agents.createVersion({
      id: 'runtime-version-two',
      agentId: 'runtime-agent',
      versionNumber: 2,
      name: 'Runtime agent',
      instructions: 'version-two',
      model: { provider: 'openai', name: 'gpt-5.5' },
    });
    versionIds = { v1: first.id, v2: 'runtime-version-two' };
    resolvedVersionIds = [];
    selectedLabels = [];

    const editorAgent = {
      clearCache: vi.fn(),
      getById: vi.fn(async (agentId: string, selector?: { label?: string; versionId?: string; status?: string }) => {
        const resolved = await agents.getByIdResolved(agentId, selector as never);
        if (!resolved) return null;

        if (resolved.resolvedVersionId) resolvedVersionIds.push(resolved.resolvedVersionId);
        if (resolved.selectedVersionLabel) selectedLabels.push(resolved.selectedVersionLabel);

        const instructions = typeof resolved.instructions === 'string' ? resolved.instructions : 'missing-marker';
        const runtimeAgent = new Agent({
          id: agentId,
          name: resolved.name,
          instructions,
          model: createMockModel({ mockText: instructions }),
        });
        runtimeAgent.__setRawConfig({ ...resolved });
        return runtimeAgent;
      }),
    };
    vi.spyOn(mastra, 'getEditor').mockReturnValue({ agent: editorAgent } as never);
  });

  function context() {
    return createTestServerContext({ mastra });
  }

  it('creates, selects, executes, moves, and executes a label again against InMemory storage', async () => {
    const created = await SET_AGENT_VERSION_LABEL_ROUTE.handler({
      ...context(),
      agentId: 'runtime-agent',
      label: 'candidate',
      versionId: versionIds.v1,
      expectedRevisionToken: null,
    });

    const selected = await GET_STORED_AGENT_ROUTE.handler({
      ...context(),
      storedAgentId: 'runtime-agent',
      label: 'candidate',
    });
    expect(selected).toMatchObject({
      instructions: 'version-one',
      resolvedVersionId: versionIds.v1,
      selectedVersionLabel: 'candidate',
    });

    const firstRun = await GENERATE_AGENT_ROUTE.handler({
      ...context(),
      agentId: 'runtime-agent',
      messages: 'run candidate',
      label: 'candidate',
      versions: { self: { label: 'candidate' } },
    });
    expect(firstRun.text).toBe('version-one');
    expect(resolvedVersionIds).toEqual([versionIds.v1]);
    expect(selectedLabels).toEqual(['candidate']);

    await SET_AGENT_VERSION_LABEL_ROUTE.handler({
      ...context(),
      agentId: 'runtime-agent',
      label: 'candidate',
      versionId: versionIds.v2,
      expectedRevisionToken: created.revisionToken!,
    });

    const secondRun = await GENERATE_AGENT_ROUTE.handler({
      ...context(),
      agentId: 'runtime-agent',
      messages: 'run candidate again',
      versions: { self: { label: 'candidate' } },
    });
    expect(secondRun.text).toBe('version-two');
    expect(resolvedVersionIds).toEqual([versionIds.v1, versionIds.v2]);
    expect(selectedLabels).toEqual(['candidate', 'candidate']);
  });

  it('rejects conflicting selector shapes and sources with the public error envelope', async () => {
    const mixedQuery = await readHttpError(
      GET_AGENT_BY_ID_ROUTE.handler({
        ...context(),
        agentId: 'runtime-agent',
        label: 'candidate',
        versionId: versionIds.v1,
      }),
    );
    expect(mixedQuery).toMatchObject({
      status: 400,
      body: { error: { code: 'INVALID_VERSION_SELECTOR' } },
    });

    const mismatch = await readHttpError(
      GENERATE_AGENT_ROUTE.handler({
        ...context(),
        agentId: 'runtime-agent',
        messages: 'conflicting run',
        label: 'candidate',
        versions: { self: { versionId: versionIds.v1 } },
      }),
    );
    expect(mismatch).toMatchObject({
      status: 400,
      body: { error: { code: 'INVALID_VERSION_SELECTOR' } },
    });

    const legacyContext = context();
    legacyContext.requestContext.set('agentVersionId', versionIds.v1);
    const canonicalWithLegacy = await readHttpError(
      GENERATE_AGENT_ROUTE.handler({
        ...legacyContext,
        agentId: 'runtime-agent',
        messages: 'duplicate legacy selector',
        versions: { self: { versionId: versionIds.v1 } },
      }),
    );
    expect(canonicalWithLegacy).toMatchObject({
      status: 400,
      body: { error: { code: 'INVALID_VERSION_SELECTOR' } },
    });

    const emptyVersionId = await readHttpError(
      GET_STORED_AGENT_ROUTE.handler({
        ...context(),
        storedAgentId: 'runtime-agent',
        versionId: '',
      }),
    );
    expect(emptyVersionId).toMatchObject({
      status: 400,
      body: { error: { code: 'INVALID_VERSION_SELECTOR' } },
    });

    const invalidLabelBeforeComparison = await readHttpError(
      GENERATE_AGENT_ROUTE.handler({
        ...context(),
        agentId: 'runtime-agent',
        messages: 'invalid label',
        label: 'Uppercase',
        versions: { self: { versionId: versionIds.v1 } },
      }),
    );
    expect(invalidLabelBeforeComparison).toMatchObject({
      status: 400,
      body: { error: { code: 'INVALID_LABEL' } },
    });
  });

  it('fails closed and maps a missing runtime label', async () => {
    const missing = await readHttpError(
      GENERATE_AGENT_ROUTE.handler({
        ...context(),
        agentId: 'runtime-agent',
        messages: 'missing label',
        versions: { self: { label: 'missing' } },
      }),
    );
    expect(missing).toMatchObject({
      status: 404,
      body: { error: { code: 'LABEL_NOT_FOUND' } },
    });
    expect(resolvedVersionIds).toEqual([]);
  });

  it('does not run a code-defined default when label resolution is unavailable', async () => {
    const codeAgent = new Agent({
      id: 'code-agent',
      name: 'Code agent',
      instructions: 'code-default',
      model: createMockModel({ mockText: 'code-default' }),
    });
    const codeMastra = new Mastra({ logger: false, agents: { codeAgent } });

    const unsupported = await readHttpError(
      GET_AGENT_BY_ID_ROUTE.handler({
        ...createTestServerContext({ mastra: codeMastra }),
        agentId: 'code-agent',
        label: 'candidate',
      }),
    );
    expect(unsupported).toMatchObject({
      status: 501,
      body: { error: { code: 'VERSION_LABELS_UNSUPPORTED' } },
    });
  });

  it('uses the structured not-found envelope for a missing stored agent', async () => {
    const missing = await readHttpError(
      GET_STORED_AGENT_ROUTE.handler({
        ...context(),
        storedAgentId: 'missing-agent',
        label: 'candidate',
      }),
    );
    expect(missing).toMatchObject({
      status: 404,
      body: { error: { code: 'ENTITY_NOT_FOUND' } },
    });
  });
});
