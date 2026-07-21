/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { FGADeniedError } from '../../auth/ee/fga-check';
import type { IFGAProvider } from '../../auth/ee/interfaces/fga';
import { EventEmitterPubSub } from '../../events';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';
import { DurableStepIds } from '../durable/constants';
import { createDurableAgent } from '../durable/create-durable-agent';
import { globalRunRegistry } from '../durable/run-registry';

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

function createMockMastra(fgaProvider?: IFGAProvider) {
  return {
    getServer: () => (fgaProvider ? { fga: fgaProvider } : {}),
    getLogger: () => undefined,
    getMemory: () => undefined,
    getStorage: () => undefined,
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
        {
          resource: { type: 'agent', id: 'test-agent' },
          permission: 'agents:execute',
          context: expect.objectContaining({
            requestContext,
            metadata: expect.objectContaining({
              agentId: 'test-agent',
              agentName: 'test-agent',
            }),
          }),
        },
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

    it('should fail closed when FGA is configured and no user is available', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const mastra = createMockMastra(fgaProvider);

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: {} as any });
      (agent as any).__registerMastra(mastra);

      await expect(agent.generate('test', { requestContext: new RequestContext() as any })).rejects.toThrow(
        FGADeniedError,
      );
      expect(fgaProvider.require).not.toHaveBeenCalled();
    });

    it('should bypass membership resolution for a tenant-scoped trusted actor', async () => {
      const fgaProvider = createMockFGAProvider(true);
      const model = createMockModel();

      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model });
      const mastra = new Mastra({
        agents: { testAgent: agent },
        logger: false,
        pubsub: new EventEmitterPubSub(),
        server: { fga: fgaProvider },
      });
      await mastra.startWorkers();

      const requestContext = new RequestContext();
      requestContext.set('organizationId', 'org-1');

      try {
        await agent.generate('test', {
          requestContext: requestContext as any,
          actor: { actorKind: 'system', sourceWorkflow: 'nightly-workflow' },
        });
      } finally {
        await mastra.stopWorkers();
      }

      expect(fgaProvider.require).not.toHaveBeenCalled();
      expect(model.doGenerateCalls).toHaveLength(1);
    });

    it('should not call FGA check when no FGA provider configured', async () => {
      const model = createMockModel();

      // No Mastra is registered, so the agent runs on its ephemeral Mastra,
      // which has no FGA provider — exercising the "FGA not configured" path
      // while still giving the evented loop the pubsub/workers it needs.
      const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model });

      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });

      await agent.generate('test', { requestContext: requestContext as any });

      expect(model.doGenerateCalls).toHaveLength(1);
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
        {
          resource: { type: 'agent', id: 'test-agent' },
          permission: 'agents:execute',
          context: expect.objectContaining({
            requestContext,
            metadata: expect.objectContaining({
              agentId: 'test-agent',
              agentName: 'test-agent',
            }),
          }),
        },
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
  });
});

describe('DurableAgent FGA checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // DurableAgent overrides stream()/generate() and runs a workflow; it must
  // still enforce agents:execute before execution (regression for the durable
  // bypass). Denial happens before the model runs.
  async function expectDurableDenial(method: 'generate' | 'stream') {
    const fgaProvider = createMockFGAProvider(false);
    const model = createMockModel();
    const pubsub = new EventEmitterPubSub();
    const base = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model });
    const durableAgent = createDurableAgent({ agent: base, pubsub });
    const mastra = new Mastra({ agents: {}, logger: false, pubsub, server: { fga: fgaProvider } });
    (durableAgent as any).__registerMastra(mastra);

    const requestContext = new RequestContext();
    requestContext.set('user', { id: 'user-1' });
    requestContext.set('organizationId', 'org-1');

    try {
      await expect((durableAgent as any)[method]('test', { requestContext: requestContext as any })).rejects.toThrow(
        FGADeniedError,
      );
      expect(fgaProvider.require).toHaveBeenCalled();
      expect(model.doGenerateCalls).toHaveLength(0);
    } finally {
      await mastra.stopWorkers?.();
      await pubsub.close();
    }
  }

  it('generate() denies before durable execution when agents:execute is denied', async () => {
    await expectDurableDenial('generate');
  });

  it('stream() denies before durable execution when agents:execute is denied', async () => {
    await expectDurableDenial('stream');
  });

  it('resume() uses only the current call actor for authorization and workflow execution', async () => {
    const requireActor = vi.fn().mockResolvedValue(undefined);
    const requireUser = vi.fn().mockResolvedValue(undefined);
    const fgaProvider = { ...createMockFGAProvider(true), require: requireUser, requireActor };
    const pubsub = new EventEmitterPubSub();
    let defaultActor: { actorKind: 'system'; agentId: string; sourceWorkflow?: string } | undefined = {
      actorKind: 'system',
      agentId: 'default-system-agent',
      sourceWorkflow: 'default-workflow',
    };
    const defaultOptions = vi.fn(() => (defaultActor ? { actor: defaultActor } : {}));
    const base = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'test',
      model: createMockModel(),
      defaultOptions,
    });
    const durableAgent = createDurableAgent({ agent: base, pubsub });
    const mastra = new Mastra({ agents: {}, logger: false, pubsub, server: { fga: fgaProvider } });
    (durableAgent as any).__registerMastra(mastra);

    const user = { id: 'resume-user', organizationMembershipId: 'membership-1' };
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'org-1');
    requestContext.set('user', user);
    const initialActor = { actorKind: 'system' as const, agentId: 'initial-system-agent' };
    const { runId } = await durableAgent.prepare('test', {
      requestContext,
      actor: initialActor,
    });
    const resumeWorkflow = vi.fn().mockResolvedValue({ status: 'suspended' });
    vi.spyOn(durableAgent, 'getWorkflow').mockReturnValue({
      createRun: vi.fn().mockResolvedValue({ resume: resumeWorkflow }),
    } as any);
    const results: Array<{ cleanup: () => void }> = [];

    try {
      const explicitActor = { actorKind: 'system' as const, agentId: 'resume-system-agent' };
      results.push(await durableAgent.resume(runId, { approved: true }, { actor: explicitActor }));
      await vi.waitFor(() => expect(resumeWorkflow).toHaveBeenCalledTimes(1));
      expect(requireActor).toHaveBeenNthCalledWith(
        1,
        explicitActor,
        expect.objectContaining({ resource: { type: 'agent', id: 'test-agent' } }),
      );
      expect(resumeWorkflow.mock.calls[0]?.[0].actor).toBe(explicitActor);

      const freshDefaultActor = { actorKind: 'system' as const, agentId: 'fresh-default-agent' };
      defaultActor = freshDefaultActor;
      results.push(await durableAgent.resume(runId, { approved: true }));
      await vi.waitFor(() => expect(resumeWorkflow).toHaveBeenCalledTimes(2));
      expect(requireActor).toHaveBeenNthCalledWith(
        2,
        freshDefaultActor,
        expect.objectContaining({ resource: { type: 'agent', id: 'test-agent' } }),
      );
      expect(resumeWorkflow.mock.calls[1]?.[0].actor).toEqual(freshDefaultActor);

      defaultActor = undefined;
      results.push(await durableAgent.resume(runId, { approved: true }));
      await vi.waitFor(() => expect(resumeWorkflow).toHaveBeenCalledTimes(3));
      expect(requireActor).toHaveBeenCalledTimes(2);
      expect(requireUser).toHaveBeenCalledWith(
        user,
        expect.objectContaining({
          resource: { type: 'agent', id: 'test-agent' },
          context: expect.objectContaining({ requestContext }),
        }),
      );
      expect(resumeWorkflow.mock.calls[2]?.[0].actor).toBeUndefined();
    } finally {
      results.forEach(result => result.cleanup());
      durableAgent.runRegistry.cleanup(runId);
      globalRunRegistry.delete(runId);
      await mastra.stopWorkers?.();
      await pubsub.close();
    }
  });

  it('cold resume fails closed instead of reusing the persisted actor', async () => {
    const requireActor = vi.fn();
    const fgaProvider = { ...createMockFGAProvider(true), requireActor };
    const pubsub = new EventEmitterPubSub();
    const storage = new InMemoryStore();
    const base = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'test',
      model: createMockModel(),
    });
    const durableAgent = createDurableAgent({ agent: base, pubsub });
    const mastra = new Mastra({ agents: {}, logger: false, pubsub, storage, server: { fga: fgaProvider } });
    (durableAgent as any).__registerMastra(mastra);

    const runId = 'cold-resume-persisted-actor';
    const workflowsStore = await storage.getStore('workflows');
    await workflowsStore?.persistWorkflowSnapshot({
      workflowName: DurableStepIds.AGENTIC_LOOP,
      runId,
      snapshot: {
        runId,
        status: 'suspended',
        context: {
          input: {
            __workflowKind: 'durable-agent',
            runId,
            agentId: durableAgent.id,
            options: { actor: { actorKind: 'system', agentId: 'persisted-system-agent' } },
            state: {},
            requestContextEntries: { organizationId: 'org-1' },
          },
        },
      } as any,
    });

    try {
      await expect(durableAgent.resume(runId, { approved: true })).rejects.toThrow(FGADeniedError);
      expect(requireActor).not.toHaveBeenCalled();
      expect(fgaProvider.require).not.toHaveBeenCalled();
    } finally {
      durableAgent.runRegistry.cleanup(runId);
      globalRunRegistry.delete(runId);
      await mastra.stopWorkers?.();
      await pubsub.close();
    }
  });

  it.each([
    { name: 'generate()', method: 'generate' as const },
    { name: 'stream()', method: 'stream' as const },
    { name: 'stream({ untilIdle: true })', method: 'stream' as const, untilIdle: true },
  ])('$name authorizes the effective default actor exactly once', async ({ method, untilIdle }) => {
    const requireActor = vi
      .fn()
      .mockRejectedValue(new FGADeniedError(null, { type: 'agent', id: 'test-agent' }, 'agents:execute'));
    const fgaProvider = { ...createMockFGAProvider(true), requireActor };
    const model = createMockModel();
    const pubsub = new EventEmitterPubSub();
    const defaultOptions = vi.fn(() => ({
      actor: { actorKind: 'system' as const, agentId: 'default-system-agent' },
    }));
    const base = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'test',
      model,
      defaultOptions,
    });
    const durableAgent = createDurableAgent({ agent: base, pubsub });
    const mastra = new Mastra({ agents: {}, logger: false, pubsub, server: { fga: fgaProvider } });
    (durableAgent as any).__registerMastra(mastra);

    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'org-1');

    try {
      await expect((durableAgent as any)[method]('test', { requestContext, untilIdle })).rejects.toThrow(
        FGADeniedError,
      );
      expect(defaultOptions).toHaveBeenCalledTimes(1);
      expect(requireActor).toHaveBeenCalledWith(
        expect.objectContaining({ agentId: 'default-system-agent' }),
        expect.objectContaining({ resource: { type: 'agent', id: 'test-agent' } }),
      );
      expect(model.doGenerateCalls).toHaveLength(0);
    } finally {
      await mastra.stopWorkers?.();
      await pubsub.close();
    }
  });

  it('forwards trusted resume context and the tool-call label', async () => {
    const pubsub = new EventEmitterPubSub();
    const base = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: createMockModel() });
    const durableAgent = createDurableAgent({ agent: base, pubsub });
    const output = { fullStream: new ReadableStream() };
    const resume = vi.spyOn(durableAgent, 'resume').mockResolvedValue({ output } as any);
    const requestContext = new RequestContext();
    const actor = { actorKind: 'system' as const, agentId: 'approval-agent' };

    try {
      await expect(
        durableAgent.resumeStream({ approved: true }, {
          runId: 'run-1',
          toolCallId: 'tool-call-1',
          requestContext,
          memory: { resource: 'resource-1' },
          actor,
        } as any),
      ).resolves.toBe(output);
      expect(resume).toHaveBeenCalledWith(
        'run-1',
        { approved: true },
        expect.objectContaining({ toolCallId: 'tool-call-1', requestContext, actor }),
      );
    } finally {
      await pubsub.close();
    }
  });

  it.each([
    ['approveToolCallGenerate', true],
    ['declineToolCallGenerate', false],
  ] as const)('%s uses the durable generate resume signature', async (method, approved) => {
    const pubsub = new EventEmitterPubSub();
    const base = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'test', model: createMockModel() });
    const durableAgent = createDurableAgent({ agent: base, pubsub });
    const resumeGenerate = vi.spyOn(durableAgent, 'resumeGenerate').mockResolvedValue({ text: 'ok' } as any);

    try {
      await (durableAgent as any)[method]({ runId: 'run-1', toolCallId: 'tool-call-1' });
      expect(resumeGenerate).toHaveBeenCalledWith(
        'run-1',
        { approved },
        expect.objectContaining({ toolCallId: 'tool-call-1' }),
      );
    } finally {
      await pubsub.close();
    }
  });
});
