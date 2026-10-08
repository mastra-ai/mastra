/**
 * Tests the AgentController integration for the agent-agnostic `ask_user` tool.
 *
 * `ask_user` pauses via the native tool-suspension primitive (it calls
 * `suspend({ question, options, selectionMode })`). The AgentController surfaces that
 * pause through the generic `tool_suspended` event and resumes it via
 * `respondToToolSuspension({ toolCallId, resumeData })`, which feeds the user's
 * answer back into the suspended tool.
 */
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { LeasePubSub } from '../../agent/__tests__/thread-stream-test-utils';
import { createDurableAgent, globalRunRegistry } from '../../agent/durable';
import { agentThreadStreamRuntime } from '../../agent/thread-stream-runtime';
import { FGADeniedError } from '../../auth/ee/fga-check';
import { InMemoryServerCache } from '../../cache';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { askUserTool } from '../../tools/builtin/ask-user';

import { AgentController } from '../agent-controller';
import { SessionApproval, SOURCE_APPROVAL_CALLS_KEY } from '../session';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerRequestContext, AgentControllerEvent } from '../types';

vi.setConfig({ testTimeout: 30_000 });

function createAskUserToolCallStream(input: string, toolCallId = 'call-1', toolName = 'ask_user') {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({
        type: 'tool-call',
        toolCallId,
        toolName,
        input,
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

function createTextStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Thanks!' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

async function buildController(id: string, input: string, withMemory = false) {
  const storage = new InMemoryStore();
  const agent = new Agent({
    id: `agent-${id}`,
    name: `Agent ${id}`,
    instructions: 'You ask the user questions.',
    model: new MastraLanguageModelV2Mock({
      doStream: (() => {
        let callCount = 0;
        return async () => {
          callCount++;
          return { stream: callCount === 1 ? createAskUserToolCallStream(input) : createTextStream() };
        };
      })(),
    }),
    tools: { ask_user: askUserTool },
    memory: withMemory ? new MockMemory({ storage }) : undefined,
  });

  const mastra = new Mastra({ agents: { [`agent-${id}`]: agent }, logger: false, storage });
  const registeredAgent = mastra.getAgent(`agent-${id}`);

  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: `controller-${id}`,
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
    initialState: { yolo: true } as any,
  });

  await controller.init();
  const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
  await session.thread.create();
  return { controller, session, registeredAgent };
}

describe('AgentController: ask_user native suspension', () => {
  it.each([
    'warm',
    'warm-reattach',
    'warm-setup-navigation',
    'warm-approval',
    'warm-approval-reattach',
    'warm-stream-closed',
    'cold',
    'cold-durable',
    'cold-storage-only',
    'cold-denied',
    'cold-setup-failure',
    'cold-execution-failure',
  ] as const)('isolates repeated source-tool resumes from a running successor (%s)', async recovery => {
    const storage = new InMemoryStore();
    const cache = new InMemoryServerCache();
    let pubsub = new LeasePubSub();
    pubsub.retain = true;
    let sourceCalls = 0;
    const heldStream = Promise.withResolvers<ReadableStreamDefaultController>();
    const writeEntered = Promise.withResolvers<void>();
    const releaseWrite = Promise.withResolvers<void>();
    const observations: { level: unknown; mode: string; model: string; thread: string | null }[] = [];
    type State = { yolo: boolean; thinkingLevel: string; hostCount: number };
    const create = async () => {
      const tool = createTool({
        id: 'owned_state',
        description: 'Suspend and inspect source-owned state',
        inputSchema: z.object({ question: z.string() }),
        resumeSchema: z.string(),
        execute: async (input, context) => {
          if (!context?.agent?.resumeData) {
            await context?.agent?.suspend?.(input);
            return;
          }
          const controller = context.requestContext!.get('controller') as AgentControllerRequestContext<State>;
          const state = controller.getState();
          expect(controller.state.thinkingLevel).toBe(state.thinkingLevel);
          expect(controller.session.state.get()).toEqual(state);
          observations.push({
            level: state.thinkingLevel,
            mode: controller.session.modeId,
            model: controller.session.modelId,
            thread: controller.threadId,
          });
          await controller.setState({ thinkingLevel: 'medium' });
          expect(controller.state.thinkingLevel).toBe('high');
          expect(controller.getState().thinkingLevel).toBe('medium');
          expect(controller.session.state.get().thinkingLevel).toBe('medium');
          await controller.session.state.update(async value => {
            if (recovery === 'warm-reattach' && observations.length === 2) {
              writeEntered.resolve();
              await releaseWrite.promise;
            }
            return { updates: { thinkingLevel: value.thinkingLevel === 'medium' ? 'high' : 'low' }, result: undefined };
          });
          await controller.updateState!(value => ({
            updates: { hostCount: value.hostCount + 1 },
            result: undefined,
            events: [
              { type: 'info', message: 'source-only' },
              { type: 'workspace_ready', workspaceId: 'host', workspaceName: 'Host' },
            ],
          }));
          controller.emitEvent?.({ type: 'info', message: 'source-only-direct' });
          return context.agent.resumeData;
        },
      });
      const source = new Agent({
        id: `owned-source-${recovery}`,
        name: 'Source',
        instructions: 'Ask twice',
        tools: { owned_state: tool },
        memory: new MockMemory({ storage }),
        model: new MastraLanguageModelV2Mock({
          doStream: async () => {
            sourceCalls++;
            if (recovery === 'cold-execution-failure' && sourceCalls > 1) throw new Error('source execution failed');
            return {
              stream:
                sourceCalls <= 2
                  ? createAskUserToolCallStream(
                      JSON.stringify({ question: 'Continue?' }),
                      `owned-${sourceCalls}`,
                      'owned_state',
                    )
                  : createTextStream(),
            };
          },
        }),
      });
      const other = new Agent({
        id: `owned-other-${recovery}`,
        name: 'Other',
        instructions: 'Wait',
        memory: new MockMemory({ storage }),
        model: new MastraLanguageModelV2Mock({
          doStream: async () => ({
            stream: new ReadableStream({
              start(stream) {
                stream.enqueue({ type: 'stream-start', warnings: [] });
                stream.enqueue({ type: 'response-metadata', id: 'held', modelId: 'mock', timestamp: new Date(0) });
                heldStream.resolve(stream);
              },
            }),
          }),
        }),
      });
      const mastra = new Mastra({
        storage,
        cache,
        pubsub,
        logger: false,
        agents: {
          source: recovery === 'cold-durable' ? createDurableAgent({ agent: source, cache, pubsub }) : source,
          other,
        },
      });
      const controller = new AgentController<State>({
        id: `owned-controller-${recovery}`,
        storage,
        pubsub,
        workspace: createMockWorkspace(),
        initialState: { yolo: true, thinkingLevel: 'low', hostCount: 0 },
        modes: [
          {
            id: 'source',
            name: 'Source',
            agent: mastra.getAgent('source'),
            defaultModelId: 'kimi-for-coding/kimi-for-coding',
          },
          { id: 'other', name: 'Other', agent: mastra.getAgent('other'), defaultModelId: 'openai/gpt-5.5' },
        ],
        defaultModeId: 'source',
      });
      await controller.init();
      const session = await controller.createSession({
        id: `owned-session-${recovery}`,
        ownerId: 'owner',
        resourceId: `owned-resource-${recovery}`,
        createInitialThread: false,
      });
      return { session, mastra, source: mastra.getAgent('source') };
    };
    let fixture = await create();
    await fixture.session.thread.create({ id: `owned-a-${recovery}` });
    await fixture.session.state.set({ thinkingLevel: 'high' });
    const sourceEvents: AgentControllerEvent[] = [];
    fixture.session.subscribe(event => {
      sourceEvents.push(event);
    });
    await fixture.session.sendMessage({ content: 'Ask' });
    const address = fixture.session.suspensions.resolveAddress({ toolCallId: 'owned-1' })!;
    expect(address, JSON.stringify(sourceEvents)).toBeDefined();
    if (!recovery.startsWith('warm')) {
      await vi.waitFor(async () =>
        expect(
          (await fixture.source.listSuspendedRuns({ threadId: address.threadId, resourceId: address.resourceId }))
            .total,
        ).toBe(1),
      );
      await fixture.session.thread.detachFromCurrent();
      pubsub = recovery === 'cold-storage-only' ? new LeasePubSub() : pubsub.restart();
      agentThreadStreamRuntime.resetForTests();
      globalRunRegistry.clear();
      fixture = await create();
      expect(fixture.mastra.__getRunScope(address.runId)).toBeUndefined();
      if (recovery === 'cold-storage-only') {
        expect(fixture.session.suspensions.has(address)).toBe(false);
      } else {
        await fixture.session.thread.switch({ threadId: address.threadId });
        await vi.waitFor(() => expect(fixture.session.suspensions.has(address)).toBe(true));
      }
    }
    const { session } = fixture;
    const releaseSetup = Promise.withResolvers<void>();
    let pendingResume: Promise<void> | undefined;
    if (recovery === 'warm-setup-navigation') {
      const entered = Promise.withResolvers<void>();
      const buildToolsets = session.machinery.buildToolsets;
      vi.spyOn(session.machinery, 'buildToolsets').mockImplementationOnce(async context => {
        const tools = await buildToolsets(context);
        entered.resolve();
        await releaseSetup.promise;
        return tools;
      });
      pendingResume = session.respondToToolSuspension({ address, resumeData: 'first' });
      await entered.promise;
    }
    const threadB = await session.thread.create({ id: `owned-b-${recovery}` });
    await session.mode.switch({ modeId: 'other' });
    await session.model.switch('openai/gpt-5.5', { thinkingLevel: 'low' });
    const running = session.sendMessage({ content: 'Keep running' });
    const stream = await heldStream.promise;
    const activeRunId = session.getCurrentRunId();
    const abortSignal = session.run.getAbortSignal();
    const display = session.displayState.get();
    const cleanup = vi.spyOn(session.stream, 'cleanup');
    let navigated = false;
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });
    try {
      if (recovery === 'cold-denied') {
        const denied = new FGADeniedError(null, { type: 'agent', id: fixture.source.id }, 'agents:execute');
        const require = vi.fn().mockRejectedValue(denied);
        new Mastra({
          agents: { source: fixture.source },
          storage,
          cache,
          pubsub,
          logger: false,
          server: { fga: { check: vi.fn().mockResolvedValue(false), require, filterAccessible: vi.fn() } },
        });
        const requestContext = new RequestContext();
        requestContext.set('user', { id: 'user-1', organizationMembershipId: 'om-1' });
        await expect(
          session.respondToToolSuspension({ address, resumeData: 'denied', requestContext }),
        ).rejects.toThrow(FGADeniedError);
        expect(require).toHaveBeenCalled();
        expect(session.suspensions.has(address)).toBe(true);
        expect(observations).toEqual([]);
        expect(session.getCurrentRunId()).toBe(activeRunId);
        expect(session.state.get()).toMatchObject({ thinkingLevel: 'low', hostCount: 0 });
        expect(cleanup).not.toHaveBeenCalled();
        expect(session.displayState.get()).toEqual(display);
        expect(abortSignal?.aborted).toBe(false);
        return;
      }
      if (recovery === 'cold-setup-failure') {
        const metadataRead = vi
          .spyOn(session.thread, 'getById')
          .mockRejectedValueOnce(new Error('source metadata unavailable'));
        await expect(session.respondToToolSuspension({ address, resumeData: 'first' })).rejects.toThrow(
          'source metadata unavailable',
        );
        metadataRead.mockRestore();
        expect(session.suspensions.has(address)).toBe(true);
        expect(observations).toEqual([]);
        expect(session.getCurrentRunId()).toBe(activeRunId);
        expect(session.state.get()).toMatchObject({ thinkingLevel: 'low', hostCount: 0 });
        expect(session.displayState.get()).toEqual(display);
        expect(cleanup).not.toHaveBeenCalled();
        expect(abortSignal?.aborted).toBe(false);
      }
      if (recovery === 'cold-execution-failure') {
        await expect(session.respondToToolSuspension({ address, resumeData: 'first' })).rejects.toThrow(
          'source execution failed',
        );
        expect(session.suspensions.has(address)).toBe(false);
        expect(session.getCurrentRunId()).toBe(activeRunId);
        expect(session.state.get()).toMatchObject({ thinkingLevel: 'low', hostCount: 1 });
        expect(session.displayState.get()).toEqual(display);
        expect(cleanup).not.toHaveBeenCalled();
        expect(abortSignal?.aborted).toBe(false);
        expect(events.some(event => event.type === 'agent_end' || event.type === 'error')).toBe(false);
        return;
      }
      if (recovery === 'warm-stream-closed') {
        const subscribe = session.machinery.subscribeToThread.bind(session.machinery);
        const unsubscribe = vi.fn();
        const removeListener = vi.fn();
        vi.spyOn(session.machinery, 'onSessionDeleted').mockReturnValue(removeListener);
        vi.spyOn(session.machinery, 'subscribeToThread').mockImplementation(async input => {
          const subscription = await subscribe(input);
          const detach = subscription.unsubscribe.bind(subscription);
          subscription.unsubscribe = () => {
            unsubscribe();
            detach();
          };
          subscription.unsubscribe();
          return subscription;
        });
        vi.spyOn(fixture.source, 'sendStreamResume').mockResolvedValue({
          accepted: true,
          runId: address.runId,
          toolCallId: address.toolCallId,
        });
        await expect(session.respondToToolSuspension({ address, resumeData: 'first' })).rejects.toThrow(
          'closed before a matching run boundary',
        );
        expect(removeListener).toHaveBeenCalledOnce();
        expect(unsubscribe).toHaveBeenCalled();
        expect(session.run.getRunId()).toBe(activeRunId);
        expect(session.run.getAbortSignal()).toBe(abortSignal);
        expect(abortSignal?.aborted).toBe(false);
        expect(cleanup).not.toHaveBeenCalled();
        expect(session.displayState.get()).toEqual(display);
        return;
      }
      if (recovery.startsWith('warm-approval')) await session.state.set({ yolo: false });
      releaseSetup.resolve();
      await (pendingResume ?? session.respondToToolSuspension({ address, resumeData: 'first' }));
      const second = { ...address, toolCallId: 'owned-2' };
      if (recovery.startsWith('warm-approval')) {
        await vi.waitFor(() => expect(session.approval.isArmed(second)).toBe(true));
        expect(events.filter(event => event.type === 'tool_approval_required')).toMatchObject([
          { threadId: address.threadId, toolCallId: second.toolCallId },
        ]);
        expect(session.displayState.get()).toEqual(display);
        if (recovery === 'warm-approval-reattach') {
          navigated = true;
          await session.thread.switch({ threadId: address.threadId });
          expect(events.filter(event => event.type === 'tool_approval_required')).toHaveLength(1);
        }
        session.respondToToolApproval({ decision: 'approve', toolCallId: second.toolCallId });
        await vi.waitFor(() => expect(session.suspensions.has(second)).toBe(true));
        await vi.waitFor(() =>
          expect(session.machinery.getRunScope(address.runId)?.has(SOURCE_APPROVAL_CALLS_KEY)).not.toBe(true),
        );
      }
      expect(session.suspensions.has(second)).toBe(true);
      const resumed = session.respondToToolSuspension({ address: second, resumeData: 'second' });
      if (recovery === 'warm-reattach') {
        await writeEntered.promise;
        expect(session.thread.getId()).toBe(threadB.id);
        expect(session.getCurrentRunId()).toBe(activeRunId);
        expect(cleanup).not.toHaveBeenCalled();
        expect(abortSignal?.aborted).toBe(false);
        navigated = true;
        const switching = session.thread.switch({ threadId: address.threadId });
        await vi.waitFor(() => expect(session.thread.getId()).toBe(address.threadId));
        expect(session.state.get().thinkingLevel).toBe('medium');
        releaseWrite.resolve();
        await switching;
        await resumed;
        await vi.waitFor(() =>
          expect(events.filter(event => event.type === 'agent_end' && event.reason === 'complete')).toHaveLength(1),
        );
        expect(session.state.get()).toMatchObject({ thinkingLevel: 'high', hostCount: 2 });
        expect(events.filter(event => event.type === 'tool_suspended' && event.toolCallId === 'owned-2')).toHaveLength(
          1,
        );
        await expect(session.thread.getSettingOn({ threadId: threadB.id, key: 'thinkingLevel' })).resolves.toBe('low');
        return;
      }
      await resumed;
      if (recovery === 'warm-approval-reattach') {
        await vi.waitFor(() =>
          expect(events.filter(event => event.type === 'agent_end' && event.reason === 'complete')).toHaveLength(1),
        );
        expect(session.state.get()).toMatchObject({ thinkingLevel: 'high', hostCount: 2 });
        expect(observations).toHaveLength(2);
        expect(sourceCalls).toBe(3);
        return;
      }
      expect(observations).toEqual(
        [1, 2].map(() => ({
          level: 'high',
          mode: 'source',
          model: 'kimi-for-coding/kimi-for-coding',
          thread: address.threadId,
        })),
      );
      expect(session.thread.getId()).toBe(threadB.id);
      expect(session.mode.get()).toBe('other');
      expect(session.model.get()).toBe('openai/gpt-5.5');
      expect(session.state.get()).toMatchObject({ thinkingLevel: 'low', hostCount: 2 });
      expect(session.getCurrentRunId()).toBe(activeRunId);
      expect(abortSignal?.aborted).toBe(false);
      expect(session.run.getAbortSignal()).toBe(abortSignal);
      expect(cleanup).not.toHaveBeenCalled();
      expect(session.displayState.get()).toEqual(display);
      expect(events.filter(event => event.type === 'tool_suspended' && event.toolCallId === 'owned-2')).toHaveLength(1);
      expect(events.some(event => event.type === 'info' || event.type === 'agent_end' || event.type === 'error')).toBe(
        false,
      );
      expect(events.filter(event => event.type === 'workspace_ready')).toHaveLength(2);
      await expect(session.thread.getSettingOn({ threadId: address.threadId, key: 'thinkingLevel' })).resolves.toBe(
        'high',
      );
      expect(sourceCalls).toBe(3);
    } finally {
      releaseWrite.resolve();
      if (!navigated) {
        stream.enqueue({
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        });
        stream.close();
      }
      await running;
      await session.thread.clearAndReleaseLock();
      agentThreadStreamRuntime.resetForTests();
      globalRunRegistry.clear();
    }
  });
  it('emits tool_suspended carrying the question payload when ask_user suspends', async () => {
    const { session } = await buildController(
      'emit',
      JSON.stringify({
        question: 'Which environment?',
        options: [{ label: 'staging' }, { label: 'production' }],
      }),
    );

    const events: any[] = [];
    session.subscribe(event => events.push(event));

    await session.sendMessage({ content: 'Ask me where to deploy' });

    const suspendEvent = events.find(e => e.type === 'tool_suspended');
    expect(suspendEvent).toBeDefined();
    expect(suspendEvent.toolName).toBe('ask_user');
    expect(suspendEvent.toolCallId).toBe('call-1');
    expect(suspendEvent.suspendPayload.question).toBe('Which environment?');
    expect(suspendEvent.suspendPayload.options).toEqual([{ label: 'staging' }, { label: 'production' }]);
    expect(suspendEvent.suspendPayload.selectionMode).toBe('single_select');

    // Display state should reflect the pending suspension.
    const pending = [...session.displayState.get().pendingSuspensions.values()].find(
      suspension => suspension.toolCallId === 'call-1',
    );
    expect(pending?.toolCallId).toBe('call-1');
    expect(pending?.toolName).toBe('ask_user');
  });

  it('resumes the suspended ask_user tool with the answer via respondToToolSuspension', async () => {
    const { session } = await buildController('resume', JSON.stringify({ question: 'Your name?' }));

    const events: any[] = [];
    session.subscribe(event => events.push(event));

    await session.sendMessage({ content: 'Ask my name' });

    const suspendEvent = events.find(e => e.type === 'tool_suspended');
    expect(suspendEvent).toBeDefined();

    events.length = 0;

    await session.respondToToolSuspension({ toolCallId: suspendEvent.toolCallId, resumeData: 'Ada' });

    // Wait for the resumed run to finish.
    await vi.waitFor(() => {
      const end = events.find(e => e.type === 'agent_end');
      expect(end?.reason).toBe('complete');
    });

    expect(events.some(e => e.type === 'error')).toBe(false);
    expect(session.displayState.get().pendingSuspensions.size).toBe(0);
  });

  it('preserves the active run when a second controller resumes another thread suspension', async () => {
    const storage = new InMemoryStore();
    const cache = new InMemoryServerCache();
    const memory = new MockMemory({ storage });
    const modelPrompts: unknown[] = [];
    const activeStream = Promise.withResolvers<ReadableStreamDefaultController>();
    let modelCalls = 0;
    let pubsub = new LeasePubSub();
    pubsub.retain = true;

    const createController = async () => {
      const baseAgent = new Agent({
        id: 'cold-resume-agent',
        name: 'Cold resume agent',
        instructions: 'Ask the user for a hotel, then acknowledge their answer.',
        model: new MastraLanguageModelV2Mock({
          doStream: async ({ prompt }) => {
            modelCalls++;
            modelPrompts.push(prompt);
            if (modelCalls === 1) {
              return { stream: createAskUserToolCallStream(JSON.stringify({ question: 'Which hotel?' })) };
            }
            if (modelCalls === 2) {
              return {
                stream: new ReadableStream({
                  start(controller) {
                    controller.enqueue({ type: 'stream-start', warnings: [] });
                    controller.enqueue({
                      type: 'response-metadata',
                      id: 'active-run',
                      modelId: 'mock',
                      timestamp: new Date(0),
                    });
                    activeStream.resolve(controller);
                  },
                }),
              };
            }
            return { stream: createTextStream() };
          },
        }),
        tools: { ask_user: askUserTool },
        memory,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, cache, pubsub });
      const mastra = new Mastra({ agents: { agent: durableAgent }, storage, cache, pubsub, logger: false });
      const controller = new AgentController({
        id: 'cold-resume-controller',
        agent: mastra.getAgent('agent'),
        pubsub,
        workspace: createMockWorkspace(),
        storage,
        initialState: { yolo: false } as any,
        modes: [{ id: 'default', name: 'Default', default: true }],
      });
      await controller.init();
      return controller;
    };

    const firstController = await createController();
    const firstSession = await firstController.createSession({
      id: 'cold-resume-session',
      ownerId: 'cold-resume-owner',
    });
    await firstSession.thread.create();
    const threadId = firstSession.thread.requireId();
    await firstSession.permissions.setForTool({ toolName: 'ask_user', policy: 'allow' });

    const firstEvents: AgentControllerEvent[] = [];
    firstSession.subscribe(event => firstEvents.push(event));
    await firstSession.sendMessage({ content: 'Ask me which hotel.' });
    await vi.waitFor(() => expect(firstEvents.some(event => event.type === 'tool_suspended')).toBe(true));
    expect(pubsub.retainedTopics()).not.toEqual([]);

    await firstSession.thread.detachFromCurrent();
    pubsub = pubsub.restart();
    agentThreadStreamRuntime.resetForTests();
    globalRunRegistry.clear();

    const secondController = await createController();
    const secondSession = await secondController.createSession({
      id: 'cold-resume-session',
      ownerId: 'cold-resume-owner',
    });
    const secondEvents: AgentControllerEvent[] = [];
    secondSession.subscribe(event => {
      secondEvents.push(event);
      if (event.type === 'tool_approval_required') {
        queueMicrotask(() => {
          void secondSession.respondToToolApproval({ decision: 'approve', toolCallId: event.toolCallId });
        });
      }
    });
    await secondSession.thread.switch({ threadId });

    await vi.waitFor(() => {
      expect(
        [...secondSession.displayState.get().pendingSuspensions.values()].find(
          suspension => suspension.toolCallId === 'call-1',
        )?.toolName,
      ).toBe('ask_user');
    });
    expect(secondEvents.some(event => event.type === 'tool_approval_required')).toBe(false);
    expect(modelCalls).toBe(1);
    const claim = secondSession.claimToolSuspension('call-1');
    expect(claim).toMatchObject({ accepted: true, toolCallId: 'call-1' });
    if (!claim.accepted) throw new Error('Expected suspension claim to succeed');
    const successorThread = await secondSession.thread.create({ id: 'successor-thread' });
    const activeRun = secondSession.sendMessage({ content: 'Keep this successor run active.' });
    const activeStreamController = await activeStream.promise;
    await vi.waitFor(() => expect(secondSession.getCurrentRunId()).not.toBeNull());
    const activeRunId = secondSession.getCurrentRunId();
    const cleanupActiveSubscription = vi.spyOn(secondSession.stream, 'cleanup');

    await secondSession.respondToToolSuspension({ address: claim.address, resumeData: 'Hilton' });

    await vi.waitFor(() => expect(modelCalls).toBe(3));
    expect(cleanupActiveSubscription).not.toHaveBeenCalled();
    expect(secondSession.getCurrentRunId()).toBe(activeRunId);
    expect(secondSession.thread.getId()).toBe(successorThread.id);
    const resumedPrompt = JSON.stringify(modelPrompts[2]);
    expect(resumedPrompt).toContain('User answered: Hilton');
    expect(resumedPrompt).not.toContain('Tool input validation failed');
    expect(resumedPrompt).not.toContain('"approved":true');
    expect(secondEvents.filter(event => event.type === 'error')).toEqual([]);

    activeStreamController.enqueue({
      type: 'finish',
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    });
    activeStreamController.close();
    await activeRun;
  });

  it('emits the resumed reply with its persisted message ID (#23150)', async () => {
    const { session } = await buildController('resume-identity', JSON.stringify({ question: 'Your name?' }), true);
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(structuredClone(event)));

    await session.sendMessage({ content: 'Ask my name' });
    expect(events.some(event => event.type === 'tool_suspended')).toBe(true);
    events.length = 0;
    await session.respondToToolSuspension({ toolCallId: 'call-1', resumeData: 'Ada' });
    await vi.waitFor(() => {
      expect(events.find(event => event.type === 'agent_end')?.reason).toBe('complete');
    });

    const persisted = await session.thread.listMessages({ threadId: session.thread.requireId() });
    const savedReplies = persisted.filter(
      message =>
        message.role === 'assistant' &&
        message.content.parts.some(part => part.type === 'text' && part.text === 'Thanks!'),
    );
    const replies = events
      .filter(event => event.type === 'message_end')
      .filter(event => savedReplies.some(message => message.id === event.id));
    expect(savedReplies).toHaveLength(1);
    expect(replies).toHaveLength(1);
    expect(replies[0]!.id).toBe(savedReplies[0]!.id);
    expect(events.some(event => event.type === 'tool_end' && event.toolCallId === 'call-1')).toBe(true);
    expect(session.displayState.get().pendingSuspensions.size).toBe(0);
    expect(events.some(event => event.type === 'error')).toBe(false);
  });

  it('emits multi_select in the suspend payload when requested', async () => {
    const { session } = await buildController(
      'multi',
      JSON.stringify({
        question: 'Pick any',
        options: [{ label: 'a' }, { label: 'b' }, { label: 'c' }],
        selectionMode: 'multi_select',
      }),
    );

    const events: any[] = [];
    session.subscribe(event => events.push(event));

    await session.sendMessage({ content: 'Ask me to pick' });

    const suspendEvent = events.find(e => e.type === 'tool_suspended');
    expect(suspendEvent.suspendPayload.selectionMode).toBe('multi_select');
  });

  it('keeps multiple pending suspensions and resumes the one selected by toolCallId (#13642)', async () => {
    // The agent only surfaces one suspension per step, but the controller must be able
    // to hold several pending suspensions at once and resume exactly the requested
    // one. Drive the toolCallId-keyed tracking directly to assert that selection.
    const { session } = await buildController('concurrent', JSON.stringify({ question: 'First?' }));

    const resumed: string[] = [];
    (session as any).resumeToolCall = async ({ address }: { address: { toolCallId: string } }) => {
      resumed.push(address.toolCallId);
      session.suspensions.delete(address as any);
    };

    const pending = session.suspensions;
    const threadId = session.thread.requireId();
    const resourceId = session.identity.getResourceId();
    pending.register({ toolCallId: 'call-a', runId: 'run-a', toolName: 'ask_user', threadId, resourceId });
    pending.register({ toolCallId: 'call-b', runId: 'run-b', toolName: 'ask_user', threadId, resourceId });

    // Explicit toolCallId resumes only that suspension; the other stays pending.
    await session.respondToToolSuspension({ toolCallId: 'call-b', resumeData: 'two' });
    expect(resumed).toEqual(['call-b']);
    expect(pending.has({ toolCallId: 'call-a' })).toBe(true);
    expect(pending.has({ toolCallId: 'call-b' })).toBe(false);

    // The remaining suspension can then be resumed by its own toolCallId.
    await session.respondToToolSuspension({ toolCallId: 'call-a', resumeData: 'one' });
    expect(resumed).toEqual(['call-b', 'call-a']);
    expect(pending.hasPending()).toBe(false);
  });

  it('carries the claimed suspension address across a thread switch', async () => {
    const { session } = await buildController('switch-after-claim', JSON.stringify({ question: 'Old thread?' }));
    const originalThreadId = session.thread.requireId();
    const resourceId = session.identity.getResourceId();
    session.suspensions.register({
      toolCallId: 'call-shared',
      runId: 'run-old',
      toolName: 'ask_user',
      threadId: originalThreadId,
      resourceId,
    });

    const resumed: unknown[] = [];
    (session as any).resumeToolCall = async ({ address }: { address: unknown }) => {
      resumed.push(address);
      session.suspensions.delete(address as any);
    };

    const claim = session.claimToolSuspension('call-shared');
    expect(claim).toMatchObject({ accepted: true });
    if (!claim.accepted) throw new Error('Expected suspension claim to succeed');

    await session.thread.create({ id: 'new-active-thread' });
    await session.respondToToolSuspension({ address: claim.address, resumeData: 'answer' });

    expect(resumed).toEqual([
      {
        threadId: originalThreadId,
        resourceId,
        runId: 'run-old',
        toolCallId: 'call-shared',
      },
    ]);
    expect(session.thread.getId()).toBe('new-active-thread');
    expect(session.suspensions.get(claim.address)).toBeUndefined();
  });

  it('resolves the sole pending suspension when toolCallId is omitted', async () => {
    const { session } = await buildController('sole', JSON.stringify({ question: 'Only?' }));

    const resumed: string[] = [];
    (session as any).resumeToolCall = async ({ address }: { address: { toolCallId: string } }) => {
      resumed.push(address.toolCallId);
      session.suspensions.delete(address as any);
    };

    const pending = session.suspensions;
    const threadId = session.thread.requireId();
    const resourceId = session.identity.getResourceId();
    pending.register({ toolCallId: 'call-only', runId: 'run-only', toolName: 'ask_user', threadId, resourceId });

    await session.respondToToolSuspension({ resumeData: 'ok' });
    expect(resumed).toEqual(['call-only']);

    // With more than one pending and no toolCallId, the call is a no-op.
    pending.register({ toolCallId: 'call-x', runId: 'run-x', toolName: 'ask_user', threadId, resourceId });
    pending.register({ toolCallId: 'call-y', runId: 'run-y', toolName: 'ask_user', threadId, resourceId });
    await session.respondToToolSuspension({ resumeData: 'ambiguous' });
    expect(resumed).toEqual(['call-only']);
    expect(pending.has({ toolCallId: 'call-x' })).toBe(true);
    expect(pending.has({ toolCallId: 'call-y' })).toBe(true);
  });

  it('clears pending suspensions on abort so the controller is no longer parked (and resume is a no-op)', async () => {
    // A run parked in a tool suspend() is not actively streaming, so abort() must
    // drop the pending suspensions itself — otherwise the controller reports it is
    // awaiting input forever and the UI can never recover.
    const { session } = await buildController('abort', JSON.stringify({ question: 'Pick?' }));

    let resumed = false;
    (session as any).resumeToolCall = async () => {
      resumed = true;
    };

    const pending = session.suspensions;
    const threadId = session.thread.requireId();
    const resourceId = session.identity.getResourceId();
    pending.register({ toolCallId: 'call-a', runId: 'run-a', toolName: 'ask_user', threadId, resourceId });
    pending.register({ toolCallId: 'call-b', runId: 'run-b', toolName: 'ask_user', threadId, resourceId });
    expect(session.suspensions.hasPending()).toBe(true);

    session.abort();

    expect(session.suspensions.hasPending()).toBe(false);
    expect(pending.hasPending()).toBe(false);

    // Resuming a suspension that abort already dropped is a safe no-op.
    await session.respondToToolSuspension({ toolCallId: 'call-a', resumeData: 'late' });
    expect(resumed).toBe(false);
  });

  it('releases a parked tool-approval gate on abort (resolves as decline) so the run can finalize', async () => {
    // A run awaiting approval.arm() is not actively streaming, so abort() must
    // resolve the parked gate itself — otherwise the await never settles and the
    // run hangs. Resolving as a decline rejects the gated tool, which is correct
    // for an aborted run.
    const { session } = await buildController('approval-abort', JSON.stringify({ question: 'Pick?' }));

    const approval = session.approval;
    const parked = approval.arm({ toolName: 'edit_file', toolCallId: 'call-1' });
    expect(approval.isArmed()).toBe(true);

    session.abort();

    const decision = await parked;
    expect(decision.decision).toBe('decline');
    expect(approval.isArmed()).toBe(false);
  });

  it('ignores a tool-approval response whose toolCallId does not match the armed gate', async () => {
    // A stale/delayed approval request must not resolve a different pending gate.
    // When a toolCallId is supplied it has to match the armed call; a mismatch is
    // a no-op so the gate stays parked for the correct responder.
    const approval = new SessionApproval();
    const parked = approval.arm({ toolName: 'edit_file', toolCallId: 'call-current' });
    expect(approval.isArmed()).toBe(true);
    expect(approval.getToolCallIds()).toEqual(['call-current']);

    // Wrong id: ignored, gate remains armed.
    approval.respond({ decision: 'approve', toolCallId: 'call-stale' });
    expect(approval.isArmed()).toBe(true);

    // The matching id resolves it.
    approval.respond({ decision: 'approve', toolCallId: 'call-current' });
    const decision = await parked;
    expect(decision.decision).toBe('approve');
    expect(approval.isArmed()).toBe(false);
    expect(approval.getToolCallIds()).toEqual([]);
  });

  it('surfaces three ask_user questions one at a time across resumes (#13642 serialized flow)', async () => {
    // When the model emits three ask_user calls in one step, suspend-capable tools
    // run sequentially: only the first suspends per run, and answering it resumes
    // the run so the next executes and suspends. The controller must therefore emit
    // exactly one tool_suspended per question, in order, with no replay — this is
    // the event sequence the TUI relies on to activate each prompt in turn.
    const questions = [
      { toolCallId: 'call-color', question: 'What is your favorite color?' },
      { toolCallId: 'call-size', question: 'Pick a size:' },
      { toolCallId: 'call-toppings', question: 'Pick toppings:' },
    ];

    const threeCallsStream = () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
          for (const { toolCallId, question } of questions) {
            controller.enqueue({
              type: 'tool-call',
              toolCallId,
              toolName: 'ask_user',
              input: JSON.stringify({ question }),
              providerExecuted: false,
            });
          }
          controller.enqueue({
            type: 'finish',
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          });
          controller.close();
        },
      });

    const agent = new Agent({
      id: 'agent-serial',
      name: 'Agent Serial',
      instructions: 'You ask the user questions.',
      model: new MastraLanguageModelV2Mock({
        doStream: (() => {
          let callCount = 0;
          return async () => {
            callCount++;
            return { stream: callCount === 1 ? threeCallsStream() : createTextStream() };
          };
        })(),
      }),
      tools: { ask_user: askUserTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({ agents: { 'agent-serial': agent }, logger: false, storage });
    const registeredAgent = mastra.getAgent('agent-serial');
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'controller-serial',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    await session.thread.create();

    const events: any[] = [];
    session.subscribe(event => events.push(event));

    await session.sendMessage({ content: 'Ask me three things' });

    // Only the first question suspends on the initial run.
    let suspensions = events.filter(e => e.type === 'tool_suspended');
    expect(suspensions.map(e => e.toolCallId)).toEqual(['call-color']);

    // Answering each question resumes the run and surfaces exactly the next one.
    for (let i = 0; i < questions.length; i++) {
      events.length = 0;
      await session.respondToToolSuspension({ toolCallId: questions[i].toolCallId, resumeData: 'answer' });

      suspensions = events.filter(e => e.type === 'tool_suspended');
      const next = questions[i + 1];
      if (next) {
        // The next question suspends — and the resume must NOT replay tool_start
        // for already-streamed calls (no duplicate streamed boxes in the TUI).
        expect(suspensions.map(e => e.toolCallId)).toEqual([next.toolCallId]);
        expect(events.some(e => e.type === 'tool_start')).toBe(false);
      } else {
        // Last answer completes the run with no further suspensions. The resume
        // call returns once the matching tool result boundary is observed, so the
        // final agent_end may arrive on the subscription shortly after.
        expect(suspensions).toHaveLength(0);
        await vi.waitFor(() => {
          expect(events.some(e => e.type === 'agent_end' && e.reason === 'complete')).toBe(true);
        });
      }
    }

    expect(session.displayState.get().pendingSuspensions.size).toBe(0);
  });
});

describe('AgentController: Stop on a parked question frees the thread', () => {
  async function buildRecording(id: string) {
    const prompts: unknown[] = [];
    const agent = new Agent({
      id: `agent-${id}`,
      name: `Agent ${id}`,
      instructions: 'You ask the user questions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async (options: any) => {
          prompts.push(options?.prompt);
          return {
            stream:
              prompts.length === 1
                ? createAskUserToolCallStream(JSON.stringify({ question: 'Red or blue?' }))
                : createTextStream(),
          };
        },
      }),
      tools: { ask_user: askUserTool },
    });
    const storage = new InMemoryStore();
    const mastra = new Mastra({ agents: { [`agent-${id}`]: agent }, logger: false, storage });
    const registeredAgent = mastra.getAgent(`agent-${id}`);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: `controller-${id}`,
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await controller.init();
    const session = await controller.createSession({ id: `session-${id}`, ownerId: 'test-owner' });
    await session.thread.create();
    const ends: Array<string | undefined> = [];
    session.subscribe(event => {
      if (event.type === 'agent_end') ends.push(event.reason);
    });
    return { controller, session, prompts, ends };
  }

  it('answers a message sent after Stop on a parked question', async () => {
    const { controller, session, prompts, ends } = await buildRecording('stop-then-send');
    await session.sendMessage({ content: 'Ask me a color.' });
    expect(ends).toEqual(['suspended']);

    session.abort();
    const next = session.sendMessage({ content: 'Forget the color and say hello.' });
    void next.catch(() => {});

    // The parked run no longer holds the thread: the new message starts its own run.
    await vi.waitFor(() => expect(ends.at(-1)).toBe('complete'), { timeout: 10_000 });
    await next;
    expect(prompts).toHaveLength(2);
    expect(JSON.stringify(prompts[1])).toContain('Forget the color and say hello.');
    expect(session.displayState.get().isRunning).toBe(false);
    expect(controller.listActiveThreadRuns()).toHaveLength(0);
  }, 20_000);
});

describe('resume boundary waiter', () => {
  it('settles when the stream is torn down before any terminal event', async () => {
    const { session } = await buildController('teardown', JSON.stringify({ question: 'Color?' }));
    const waiter = (session as any).createSubscribedResumeBoundaryWaiter({ toolCallId: 'call-1' });
    let settled = false;
    void waiter.promise.then(() => {
      settled = true;
    });

    session.stream.cleanup();

    await vi.waitFor(() => expect(settled).toBe(true));
  });
});
