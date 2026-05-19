/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

import { FGADeniedError } from '../../auth/ee/fga-check';
import type { IFGAProvider } from '../../auth/ee/interfaces/fga';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '../../request-context';
import { Agent } from '../agent';

function createMockFGAProvider(authorized = true): IFGAProvider {
  return {
    check: vi.fn().mockResolvedValue(authorized),
    require: authorized
      ? vi.fn().mockResolvedValue(undefined)
      : vi
          .fn()
          .mockRejectedValue(
            new FGADeniedError({ id: 'user-1' }, { type: 'agent', id: 'test-agent' }, 'agents:execute'),
          ),
    filterAccessible: vi.fn(),
  };
}

function createMockMastra(
  fgaProvider?: IFGAProvider,
  getStorage: () => unknown = () => undefined,
  getMemory: () => unknown = () => undefined,
) {
  return {
    getServer: () => (fgaProvider ? { fga: fgaProvider } : {}),
    getLogger: () => undefined,
    getMemory,
    getStorage,
    getWorkspace: () => undefined,
    getVersionOverrides: () => undefined,
    generateId: () => 'test-run-id',
    listGateways: () => [],
  } as any;
}

function createMockModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      finishReason: 'stop',
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      content: [{ type: 'text', text: 'ok' }],
    }),
  });
}

function createWorkflowRunStorage({
  resourceId,
  snapshot = { context: {} },
  loadedSnapshot = snapshot,
}: {
  resourceId?: string;
  snapshot?: unknown;
  loadedSnapshot?: unknown;
}) {
  const workflowsStore = {
    getWorkflowRunById: vi.fn().mockResolvedValue({
      workflowName: 'agentic-loop',
      runId: 'suspended-run-id',
      resourceId,
      snapshot,
    }),
    loadWorkflowSnapshot: vi.fn().mockResolvedValue(loadedSnapshot),
  };
  const storage = {
    getStore: vi.fn().mockReturnValue(workflowsStore),
  };
  return {
    getStorage: vi.fn(() => storage),
    storage,
    workflowsStore,
  };
}

function expectNoResumeOwnerError(error: unknown) {
  if (error && typeof error === 'object' && 'id' in error) {
    expect((error as { id?: string }).id?.startsWith('AGENT_RESUME_OWNER_')).toBe(false);
  }
}

describe('Agent FGA checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generate()', () => {
    it('should call FGA provider check when FGA provider is configured', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1', organizationMembershipId: 'om-1' });

      try {
        await agent.generate('test', { requestContext: requestContext as any });
      } catch {
        // Expected to fail due to no real model
      }

      expect(fgaProvider.require).toHaveBeenCalledWith(
        { id: 'user-1', organizationMembershipId: 'om-1' },
        { resource: { type: 'agent', id: 'test-agent' }, permission: 'agents:execute' },
      );
    });

    it('should throw FGADeniedError when FGA check fails', async () => {
      const fgaProvider = createMockFGAProvider(false);
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });

      await expect(agent.generate('test', { requestContext: requestContext as any })).rejects.toThrow(FGADeniedError);
    });

    it('should reject missing users when FGA is configured', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);
      const model = createMockModel();

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model });
      (agent as any).__registerMastra(mastra);

      await expect(agent.generate('test')).rejects.toThrow(FGADeniedError);
      expect(fgaProvider.require).not.toHaveBeenCalled();
      expect(model.doGenerateCalls).toHaveLength(0);
    });

    it('should reject missing users before request context schema validation when FGA is configured', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);
      const model = createMockModel();

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test',
        model,
        requestContextSchema: z.object({ user: z.object({ id: z.string() }) }),
      });
      (agent as any).__registerMastra(mastra);

      await expect(agent.generate('test', { requestContext: new RequestContext() as any })).rejects.toThrow(
        FGADeniedError,
      );
      expect(fgaProvider.require).not.toHaveBeenCalled();
      expect(model.doGenerateCalls).toHaveLength(0);
    });

    it('should not call FGA check when no FGA provider configured', async () => {
      const mastra = createMockMastra();
      const model = createMockModel();

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });

      await agent.generate('test', { requestContext: requestContext as any });

      expect(model.doGenerateCalls).toHaveLength(1);
    });

    it('should still run local calls without a user when no FGA provider is configured', async () => {
      const mastra = createMockMastra();
      const model = createMockModel();

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model });
      (agent as any).__registerMastra(mastra);

      await agent.generate('test');

      expect(model.doGenerateCalls).toHaveLength(1);
    });

    it('should authorize the effective request context from default options', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);
      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'default-user', organizationMembershipId: 'default-om' });

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test',
        model: {} as any,
        defaultOptions: { requestContext: requestContext as any },
      });
      (agent as any).__registerMastra(mastra);

      try {
        await agent.generate('test');
      } catch {
        // Expected to fail due to no real model.
      }

      expect(fgaProvider.require).toHaveBeenCalledWith(
        { id: 'default-user', organizationMembershipId: 'default-om' },
        { resource: { type: 'agent', id: 'test-agent' }, permission: 'agents:execute' },
      );
      expect(fgaProvider.require).toHaveBeenCalledTimes(1);
    });

    it('should reject default request contexts without users when FGA is configured', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel(),
        defaultOptions: { requestContext: new RequestContext() as any },
      });
      (agent as any).__registerMastra(mastra);

      await expect(agent.generate('test')).rejects.toThrow(FGADeniedError);
      expect(fgaProvider.require).not.toHaveBeenCalled();
    });

    it('should reject function default options without users when FGA is configured', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel(),
        defaultOptions: () => ({ requestContext: new RequestContext() as any }),
      });
      (agent as any).__registerMastra(mastra);

      await expect(agent.generate('test')).rejects.toThrow(FGADeniedError);
      expect(fgaProvider.require).not.toHaveBeenCalled();
    });

    it('should reject streamUntilIdle before resolving memory when FGA is configured without a user', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const getMemory = vi.fn();
      const mastra = createMockMastra(fgaProvider, () => undefined, getMemory);

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel(),
      });
      (agent as any).__registerMastra(mastra);

      await expect(agent.streamUntilIdle('test')).rejects.toThrow(FGADeniedError);
      expect(getMemory).not.toHaveBeenCalled();
      expect(fgaProvider.require).not.toHaveBeenCalled();
    });
  });

  describe('stream()', () => {
    it('should call FGA provider check when FGA provider is configured', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1', organizationMembershipId: 'om-1' });

      try {
        await agent.stream('test', { requestContext: requestContext as any });
      } catch {
        // Expected to fail due to no real model
      }

      expect(fgaProvider.require).toHaveBeenCalledWith(
        { id: 'user-1', organizationMembershipId: 'om-1' },
        { resource: { type: 'agent', id: 'test-agent' }, permission: 'agents:execute' },
      );
    });

    it('should throw FGADeniedError when FGA check fails in stream', async () => {
      const fgaProvider = createMockFGAProvider(false);
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });

      await expect(agent.stream('test', { requestContext: requestContext as any })).rejects.toThrow(FGADeniedError);
    });

    it('should reject missing users when FGA is configured', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: createMockModel() });
      (agent as any).__registerMastra(mastra);

      await expect(agent.stream('test')).rejects.toThrow(FGADeniedError);
      expect(fgaProvider.require).not.toHaveBeenCalled();
    });

    it('should still run local calls without a user when no FGA provider is configured', async () => {
      const mastra = createMockMastra();

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel(),
      });
      (agent as any).__registerMastra(mastra);

      await agent.stream('test');
    });

    it('should authorize the effective request context from default options', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);
      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'default-user', organizationMembershipId: 'default-om' });

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test',
        model: {} as any,
        defaultOptions: { requestContext: requestContext as any },
      });
      (agent as any).__registerMastra(mastra);

      try {
        await agent.stream('test');
      } catch {
        // Expected to fail due to no real model.
      }

      expect(fgaProvider.require).toHaveBeenCalledWith(
        { id: 'default-user', organizationMembershipId: 'default-om' },
        { resource: { type: 'agent', id: 'test-agent' }, permission: 'agents:execute' },
      );
    });

    it('should reject default request contexts without users when FGA is configured', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel(),
        defaultOptions: { requestContext: new RequestContext() as any },
      });
      (agent as any).__registerMastra(mastra);

      await expect(agent.stream('test')).rejects.toThrow(FGADeniedError);
      expect(fgaProvider.require).not.toHaveBeenCalled();
    });

    it('should reject function default options without users when FGA is configured', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel(),
        defaultOptions: () => ({}),
      });
      (agent as any).__registerMastra(mastra);

      await expect(agent.stream('test')).rejects.toThrow(FGADeniedError);
      expect(fgaProvider.require).not.toHaveBeenCalled();
    });
  });

  describe('resumeStream()', () => {
    it('should call FGA provider before loading a persisted snapshot', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1', organizationMembershipId: 'om-1' });

      await expect(
        agent.resumeStream({ approved: true }, { runId: 'missing-run-id', requestContext: requestContext as any }),
      ).rejects.toMatchObject({ id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND' });

      expect(fgaProvider.require).toHaveBeenCalledWith(
        { id: 'user-1', organizationMembershipId: 'om-1' },
        { resource: { type: 'agent', id: 'test-agent' }, permission: 'agents:execute' },
      );
    });

    it('should reject denied users before loading a persisted snapshot', async () => {
      const fgaProvider = createMockFGAProvider(false);
      const getStorage = vi.fn(() => ({
        getStore: vi.fn(() => ({
          loadWorkflowSnapshot: vi.fn(),
        })),
      }));
      const mastra = createMockMastra(fgaProvider, getStorage);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });

      await expect(
        agent.resumeStream({ approved: true }, { runId: 'missing-run-id', requestContext: requestContext as any }),
      ).rejects.toThrow(FGADeniedError);
      expect(getStorage).not.toHaveBeenCalled();
    });

    it('should reject missing users before loading a persisted snapshot when FGA is configured', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const getStorage = vi.fn(() => ({
        getStore: vi.fn(() => ({
          loadWorkflowSnapshot: vi.fn(),
        })),
      }));
      const mastra = createMockMastra(fgaProvider, getStorage);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      await expect(agent.resumeStream({ approved: true }, { runId: 'missing-run-id' })).rejects.toThrow(FGADeniedError);
      expect(getStorage).not.toHaveBeenCalled();
      expect(fgaProvider.require).not.toHaveBeenCalled();
    });

    it('should ignore caller-supplied preflight skip markers', async () => {
      const fgaProvider = createMockFGAProvider(false);
      const getStorage = vi.fn(() => ({
        getStore: vi.fn(() => ({
          loadWorkflowSnapshot: vi.fn(),
        })),
      }));
      const mastra = createMockMastra(fgaProvider, getStorage);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });

      await expect(
        agent.resumeStream({ approved: true }, {
          runId: 'missing-run-id',
          requestContext: requestContext as any,
          _skipAgentExecutionPreflight: true,
        } as any),
      ).rejects.toThrow(FGADeniedError);
      expect(getStorage).not.toHaveBeenCalled();
    });

    it('should authorize default requestContext before loading a persisted snapshot', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);
      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'default-user', organizationMembershipId: 'default-om' });

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test',
        model: {} as any,
        defaultOptions: { requestContext: requestContext as any },
      });
      (agent as any).__registerMastra(mastra);

      await expect(agent.resumeStream({ approved: true }, { runId: 'missing-run-id' })).rejects.toMatchObject({
        id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
      });

      expect(fgaProvider.require).toHaveBeenCalledWith(
        { id: 'default-user', organizationMembershipId: 'default-om' },
        { resource: { type: 'agent', id: 'test-agent' }, permission: 'agents:execute' },
      );
    });

    it('should reject callers whose resource does not own the suspended run', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const { getStorage } = createWorkflowRunStorage({ resourceId: 'resource-b' });
      const mastra = createMockMastra(fgaProvider, getStorage);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'resource-a');

      await expect(
        agent.resumeStream({ approved: true }, { runId: 'suspended-run-id', requestContext: requestContext as any }),
      ).rejects.toMatchObject({ id: 'AGENT_RESUME_OWNER_MISMATCH' });
    });

    it('should fail closed when FGA is configured and caller resource is missing for an owned run', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const { getStorage } = createWorkflowRunStorage({ resourceId: 'resource-b' });
      const mastra = createMockMastra(fgaProvider, getStorage);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });

      await expect(
        agent.resumeStream({ approved: true }, { runId: 'suspended-run-id', requestContext: requestContext as any }),
      ).rejects.toMatchObject({ id: 'AGENT_RESUME_OWNER_UNVERIFIED' });
    });

    it('should not trust caller-supplied memory resource as owner proof when FGA is configured', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const { getStorage } = createWorkflowRunStorage({ resourceId: 'resource-b' });
      const mastra = createMockMastra(fgaProvider, getStorage);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });

      await expect(
        agent.resumeStream(
          { approved: true },
          {
            runId: 'suspended-run-id',
            requestContext: requestContext as any,
            memory: { resource: 'resource-b' },
          },
        ),
      ).rejects.toMatchObject({ id: 'AGENT_RESUME_OWNER_UNVERIFIED' });
    });

    it('should allow non-FGA local resume callers to prove ownership with memory resource', async () => {
      const { getStorage } = createWorkflowRunStorage({ resourceId: 'resource-b' });
      const mastra = createMockMastra(undefined, getStorage);

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel() as any,
      });
      (agent as any).__registerMastra(mastra);

      let resumeError: unknown;
      try {
        await agent.resumeGenerate(
          { approved: true },
          {
            runId: 'suspended-run-id',
            memory: { resource: 'resource-b' },
          },
        );
      } catch (error) {
        resumeError = error;
      }

      expectNoResumeOwnerError(resumeError);
    });

    it('should fail closed when FGA is configured and the persisted run has no owner resource', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const { getStorage } = createWorkflowRunStorage({});
      const mastra = createMockMastra(fgaProvider, getStorage);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'resource-a');

      await expect(
        agent.resumeStream({ approved: true }, { runId: 'suspended-run-id', requestContext: requestContext as any }),
      ).rejects.toMatchObject({ id: 'AGENT_RESUME_PERSISTED_RUN_NO_OWNER' });
    });
  });

  describe('resumeStreamUntilIdle()', () => {
    it('should reject denied users before resumeStreamUntilIdle resolves memory', async () => {
      const fgaProvider = createMockFGAProvider(false);
      const getMemory = vi.fn();
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test',
        model: {} as any,
        memory: getMemory,
      });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });

      await expect(
        agent.resumeStreamUntilIdle(
          { approved: true },
          { runId: 'missing-run-id', requestContext: requestContext as any },
        ),
      ).rejects.toThrow(FGADeniedError);
      expect(getMemory).not.toHaveBeenCalled();
    });

    it('should reject missing users before resumeStreamUntilIdle resolves memory when FGA is configured', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const getMemory = vi.fn();
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test',
        model: {} as any,
        memory: getMemory,
      });
      (agent as any).__registerMastra(mastra);

      await expect(agent.resumeStreamUntilIdle({ approved: true }, { runId: 'missing-run-id' })).rejects.toThrow(
        FGADeniedError,
      );
      expect(getMemory).not.toHaveBeenCalled();
      expect(fgaProvider.require).not.toHaveBeenCalled();
    });

    it('should only check FGA once for authorized resumeStreamUntilIdle callers', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1', organizationMembershipId: 'om-1' });

      await expect(
        agent.resumeStreamUntilIdle(
          { approved: true },
          { runId: 'missing-run-id', requestContext: requestContext as any },
        ),
      ).rejects.toMatchObject({ id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND' });

      expect(fgaProvider.require).toHaveBeenCalledTimes(1);
      expect(fgaProvider.require).toHaveBeenCalledWith(
        { id: 'user-1', organizationMembershipId: 'om-1' },
        { resource: { type: 'agent', id: 'test-agent' }, permission: 'agents:execute' },
      );
    });

    it('should authorize default requestContext before resolving idle memory', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);
      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'default-user', organizationMembershipId: 'default-om' });

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test',
        model: {} as any,
        defaultOptions: { requestContext: requestContext as any },
      });
      (agent as any).__registerMastra(mastra);

      await expect(agent.resumeStreamUntilIdle({ approved: true }, { runId: 'missing-run-id' })).rejects.toMatchObject({
        id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
      });

      expect(fgaProvider.require).toHaveBeenCalledTimes(1);
      expect(fgaProvider.require).toHaveBeenCalledWith(
        { id: 'default-user', organizationMembershipId: 'default-om' },
        { resource: { type: 'agent', id: 'test-agent' }, permission: 'agents:execute' },
      );
    });

    it('should enforce run owner checks through resumeStreamUntilIdle', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const { getStorage } = createWorkflowRunStorage({ resourceId: 'resource-b' });
      const mastra = createMockMastra(fgaProvider, getStorage);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'resource-a');

      await expect(
        agent.resumeStreamUntilIdle(
          { approved: true },
          { runId: 'suspended-run-id', requestContext: requestContext as any },
        ),
      ).rejects.toMatchObject({ id: 'AGENT_RESUME_OWNER_MISMATCH' });
    });
  });

  describe('resumeGenerate()', () => {
    it('should call FGA provider before loading a persisted snapshot', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1', organizationMembershipId: 'om-1' });

      await expect(
        agent.resumeGenerate({ approved: true }, { runId: 'missing-run-id', requestContext: requestContext as any }),
      ).rejects.toMatchObject({ id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND' });

      expect(fgaProvider.require).toHaveBeenCalledWith(
        { id: 'user-1', organizationMembershipId: 'om-1' },
        { resource: { type: 'agent', id: 'test-agent' }, permission: 'agents:execute' },
      );
    });

    it('should reject denied users before loading a persisted snapshot', async () => {
      const fgaProvider = createMockFGAProvider(false);
      const getStorage = vi.fn(() => ({
        getStore: vi.fn(() => ({
          loadWorkflowSnapshot: vi.fn(),
        })),
      }));
      const mastra = createMockMastra(fgaProvider, getStorage);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });

      await expect(
        agent.resumeGenerate({ approved: true }, { runId: 'missing-run-id', requestContext: requestContext as any }),
      ).rejects.toThrow(FGADeniedError);
      expect(getStorage).not.toHaveBeenCalled();
    });

    it('should reject missing users before loading a persisted snapshot when FGA is configured', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const getStorage = vi.fn(() => ({
        getStore: vi.fn(() => ({
          loadWorkflowSnapshot: vi.fn(),
        })),
      }));
      const mastra = createMockMastra(fgaProvider, getStorage);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      await expect(agent.resumeGenerate({ approved: true }, { runId: 'missing-run-id' })).rejects.toThrow(
        FGADeniedError,
      );
      expect(getStorage).not.toHaveBeenCalled();
      expect(fgaProvider.require).not.toHaveBeenCalled();
    });

    it('should authorize default requestContext before loading a persisted snapshot', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);
      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'default-user', organizationMembershipId: 'default-om' });

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test',
        model: {} as any,
        defaultOptions: { requestContext: requestContext as any },
      });
      (agent as any).__registerMastra(mastra);

      await expect(agent.resumeGenerate({ approved: true }, { runId: 'missing-run-id' })).rejects.toMatchObject({
        id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
      });

      expect(fgaProvider.require).toHaveBeenCalledWith(
        { id: 'default-user', organizationMembershipId: 'default-om' },
        { resource: { type: 'agent', id: 'test-agent' }, permission: 'agents:execute' },
      );
    });

    it('should reject callers whose resource does not own the suspended generate run', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const { getStorage } = createWorkflowRunStorage({ resourceId: 'resource-b' });
      const mastra = createMockMastra(fgaProvider, getStorage);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'resource-a');

      await expect(
        agent.resumeGenerate({ approved: true }, { runId: 'suspended-run-id', requestContext: requestContext as any }),
      ).rejects.toMatchObject({ id: 'AGENT_RESUME_OWNER_MISMATCH' });
    });

    it('should allow a caller whose resource owns the suspended generate run', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const { getStorage } = createWorkflowRunStorage({ resourceId: 'resource-a' });
      const mastra = createMockMastra(fgaProvider, getStorage);

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel() as any,
      });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'resource-a');

      let resumeError: unknown;
      try {
        await agent.resumeGenerate(
          { approved: true },
          { runId: 'suspended-run-id', requestContext: requestContext as any },
        );
      } catch (error) {
        resumeError = error;
      }

      expectNoResumeOwnerError(resumeError);
    });

    it('should fall back to loadWorkflowSnapshot when getWorkflowRunById returns a serialized snapshot', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const { getStorage, workflowsStore } = createWorkflowRunStorage({
        resourceId: 'resource-a',
        snapshot: '{"context":{}}',
        loadedSnapshot: { context: {} },
      });
      const mastra = createMockMastra(fgaProvider, getStorage);

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel() as any,
      });
      (agent as any).__registerMastra(mastra);

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });
      requestContext.set(MASTRA_RESOURCE_ID_KEY, 'resource-a');

      let resumeError: unknown;
      try {
        await agent.resumeGenerate(
          { approved: true },
          { runId: 'suspended-run-id', requestContext: requestContext as any },
        );
      } catch (error) {
        resumeError = error;
      }

      expect(workflowsStore.loadWorkflowSnapshot).toHaveBeenCalledWith({
        workflowName: 'agentic-loop',
        runId: 'suspended-run-id',
      });
      expectNoResumeOwnerError(resumeError);
    });
  });
});
