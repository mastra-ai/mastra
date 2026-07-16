/**
 * Reproduction test for mc "send message does nothing" bug.
 * Tests the complete flow: dynamic model + controller + evented workflow engine.
 *
 * Root cause: PR #17534 (e9cf1743) removed currentModelId/modeId from the state
 * schema, so Zod stripped them during setState — getDynamicModel then threw
 * "No model selected" which was silently swallowed by the idle-start .catch()
 * in thread-stream-runtime.ts.
 *
 * Fix 1 (PR #17676): Restored currentModelId/modeId to stateSchema.
 * Fix 2 (this PR): Propagate idle-start errors to the subscription stream via
 *         the new `run-failed` event so the controller surfaces an error event.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../agent';
import { EventEmitterPubSub } from '../events/event-emitter';
import type { PubSubDeliveryMode } from '../events/pubsub';
import type { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

/** Push-only wrapper around EventEmitterPubSub — mimics mc's SignalsPubSub. */
class PushOnlyPubSub extends EventEmitterPubSub {
  override get supportedModes(): ReadonlyArray<PubSubDeliveryMode> {
    return ['push'];
  }
}

function createTextStreamModel(responseText: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
}

describe('mc send-message reproduction', () => {
  it('produces assistant response with dynamic model + init + startWorkers', async () => {
    const storage = new InMemoryStore();

    function getDynamicModel({ requestContext }: { requestContext: RequestContext }) {
      const controllerContext = requestContext.get('controller') as any;
      const modelId = controllerContext?.session?.modelId;
      if (!modelId) {
        throw new Error('No model selected');
      }
      return createTextStreamModel('Hello from the agent!');
    }

    const stateSchema = z.object({
      currentModelId: z.string().optional(),
      modeId: z.string().optional(),
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      model: getDynamicModel as any,
      instructions: 'You are a test agent.',
    });

    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      storage,
      resourceId: 'test-resource',
      modes: [{ id: 'build', agent, defaultModelId: 'anthropic/claude-opus-4-7' }],
      defaultModeId: 'build',
      stateSchema,
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    await controller.getMastra()?.startWorkers();
    await session.thread.create();

    const events: AgentControllerEvent[] = [];
    session.subscribe((event: AgentControllerEvent) => {
      events.push(event);
    });

    expect(session.model.get()).toBe('anthropic/claude-opus-4-7');

    await session.sendMessage({ content: 'Hello!' });

    const assistantEnd = events.find(
      (e): e is Extract<AgentControllerEvent, { type: 'message_end' }> =>
        e.type === 'message_end' && e.message.role === 'assistant',
    );
    expect(assistantEnd).toBeDefined();
    expect(assistantEnd!.message.content.parts).toEqual([{ type: 'text', text: 'Hello from the agent!' }]);
  }, 30000);

  it('surfaces error event when model function throws during idle-start', async () => {
    const storage = new InMemoryStore();

    function throwingModel() {
      throw new Error('No model selected');
    }

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      model: throwingModel as any,
      instructions: 'You are a test agent.',
    });

    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      storage,
      resourceId: 'test-resource',
      modes: [{ id: 'build', agent, defaultModelId: 'mock-model' }],
      defaultModeId: 'build',
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    await controller.getMastra()?.startWorkers();
    await session.thread.create();

    const events: AgentControllerEvent[] = [];
    session.subscribe((event: AgentControllerEvent) => {
      events.push(event);
    });

    await session.sendMessage({ content: 'Hello!' });

    // With the fix, the error should propagate through the subscription stream
    // and the controller should emit an error event instead of silently completing
    const errorEvent = events.find((e): e is Extract<AgentControllerEvent, { type: 'error' }> => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.error.message).toContain('No model selected');
  }, 30000);

  it('produces assistant response with push-only pubsub (like mc SignalsPubSub)', async () => {
    const storage = new InMemoryStore();
    const pushOnlyPubSub = new PushOnlyPubSub();

    function getDynamicModel({ requestContext }: { requestContext: RequestContext }) {
      const controllerContext = requestContext.get('controller') as any;
      const modelId = controllerContext?.session?.modelId;
      if (!modelId) {
        throw new Error('No model selected');
      }
      return createTextStreamModel('Hello from push-only!');
    }

    const stateSchema = z.object({
      currentModelId: z.string().optional(),
      modeId: z.string().optional(),
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      model: getDynamicModel as any,
      instructions: 'You are a test agent.',
    });

    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      storage,
      pubsub: pushOnlyPubSub,
      resourceId: 'test-resource',
      modes: [{ id: 'build', agent, defaultModelId: 'anthropic/claude-opus-4-7' }],
      defaultModeId: 'build',
      stateSchema,
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    await controller.getMastra()?.startWorkers();
    await session.thread.create();

    const events: AgentControllerEvent[] = [];
    session.subscribe((event: AgentControllerEvent) => {
      events.push(event);
    });

    expect(session.model.get()).toBe('anthropic/claude-opus-4-7');

    await session.sendMessage({ content: 'Hello!' });

    const assistantEnd = events.find(
      (e): e is Extract<AgentControllerEvent, { type: 'message_end' }> =>
        e.type === 'message_end' && e.message.role === 'assistant',
    );
    expect(assistantEnd).toBeDefined();
    expect(assistantEnd!.message.content.parts).toEqual([{ type: 'text', text: 'Hello from push-only!' }]);
  }, 30000);
});
