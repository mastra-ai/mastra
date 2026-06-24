/**
 * Tests for harness tool suspension and resumption.
 *
 * When a tool calls suspend() during execution, the harness should:
 *   1. Emit a 'tool_suspended' event to subscribers
 *   2. Report agent_end with reason 'suspended'
 *   3. Allow the caller to resume via respondToToolSuspension()
 *   4. Call agent.sendStreamResume() and continue processing through the subscription
 */
import { describe, it, expect, vi } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';

import { Harness } from '../harness';

vi.setConfig({ testTimeout: 30_000 });

function createToolCallStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'id-0',
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'confirmAction',
        input: '{"action":"deploy"}',
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
      controller.enqueue({
        type: 'response-metadata',
        id: 'id-1',
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Deployed successfully.' });
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

describe('Harness: tool suspension and resumption', () => {
  it('should not inject default model settings when sending a message', async () => {
    const agent = new Agent({
      id: 'test-agent-default-model-settings',
      name: 'Test Agent Default Model Settings',
      instructions: 'You answer directly.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createTextStream() }),
      }),
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-default-model-settings': agent },
      logger: false,
      storage,
    });

    const registeredAgent = mastra.getAgent('test-agent-default-model-settings');
    const streamSpy = vi.spyOn(registeredAgent, 'stream');

    const harness = new Harness({
      id: 'test-harness-default-model-settings',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
    });

    await harness.init();
    const session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });
    await session.thread.create();

    await session.sendMessage({ content: 'Hello' });

    expect(streamSpy).toHaveBeenCalled();
    const [, streamOptions] = streamSpy.mock.calls[0] as [any, any];
    expect(streamOptions.modelSettings).toBeUndefined();
  });

  it('should emit a suspension-related event when a tool calls suspend(), not silently complete', async () => {
    // Tool that suspends mid-execution waiting for external input
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action, reason: 'Needs user confirmation' });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: (() => {
          let callCount = 0;
          return async () => {
            callCount++;
            return { stream: callCount === 1 ? createToolCallStream() : createTextStream() };
          };
        })(),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();

    // Register agent with Mastra so snapshots are persisted (needed for resumeStream)
    const mastra = new Mastra({
      agents: { 'test-agent': agent },
      logger: false,
      storage,
    });

    const registeredAgent = mastra.getAgent('test-agent');

    const harness = new Harness({
      id: 'test-harness',
      storage,
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent: registeredAgent,
        },
      ],
      // yolo=true so tool approval is auto-allowed → tool actually executes → suspend() is called
      initialState: { yolo: true } as any,
    });

    await harness.init();
    const session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });

    // Collect all events
    const events: any[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.thread.create();

    // Send a message — the tool should execute and call suspend()
    await session.sendMessage({ content: 'Deploy to production' });

    // agent_end should fire with reason 'suspended', not 'complete'
    const agentEndEvent = events.find((e: any) => e.type === 'agent_end');
    expect(agentEndEvent?.reason).toBe('suspended');

    // A tool_suspended event should have been emitted with correct details
    const suspensionEvent = events.find((e: any) => e.type === 'tool_suspended');
    expect(suspensionEvent).toBeDefined();
    expect(suspensionEvent.toolName).toBe('confirmAction');
    expect(suspensionEvent.toolCallId).toBeDefined();
    expect(suspensionEvent.suspendPayload).toEqual({
      action: 'deploy',
      reason: 'Needs user confirmation',
    });
  });

  it('should set pendingSuspensions display state when tool suspends', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-ds',
      name: 'Test Agent DS',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-ds': agent },
      logger: false,
      storage,
    });

    const registeredAgent = mastra.getAgent('test-agent-ds');

    const harness = new Harness({
      id: 'test-harness-ds',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });

    await harness.init();
    const session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });
    await session.thread.create();
    await session.sendMessage({ content: 'Do it' });

    const ds = session.displayState.get();
    expect(ds.pendingSuspensions.size).toBe(1);
    const suspension = Array.from(ds.pendingSuspensions.values())[0];
    expect(suspension!.toolName).toBe('confirmAction');
    expect(suspension!.suspendPayload).toEqual({ action: 'deploy' });
  });

  it('should resume execution via respondToToolSuspension()', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        // Resume-aware pattern: if resumeData is present, we've already suspended once,
        // so continue instead of suspending again.
        const resumeData = context?.agent?.resumeData ?? context?.workflow?.resumeData ?? context?.resumeData;
        if (resumeData) {
          return { result: `Action "${input.action}" confirmed`, resumed: resumeData };
        }
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-resume',
      name: 'Test Agent Resume',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: (() => {
          let callCount = 0;
          return async () => {
            callCount++;
            return { stream: callCount === 1 ? createToolCallStream() : createTextStream() };
          };
        })(),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-resume': agent },
      logger: false,
      storage,
    });

    const registeredAgent = mastra.getAgent('test-agent-resume');

    const harness = new Harness({
      id: 'test-harness-resume',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });

    await harness.init();
    const session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const events: any[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.thread.create();

    // First message triggers suspension
    await session.sendMessage({ content: 'Deploy to production' });

    const suspendEnd = events.find((e: any) => e.type === 'agent_end');
    expect(suspendEnd?.reason).toBe('suspended');

    // Clear events for resume phase
    events.length = 0;

    // Resume with data
    await session.respondToToolSuspension({ resumeData: { confirmed: true } });

    // Should emit agent_start + agent_end(complete) for the resumed run
    const resumeStart = events.find((e: any) => e.type === 'agent_start');
    expect(resumeStart).toBeDefined();

    const resumeEnd = events.find((e: any) => e.type === 'agent_end');
    expect(resumeEnd).toBeDefined();
    expect(resumeEnd.reason).toBe('complete');
    expect(events.some((e: any) => e.type === 'error')).toBe(false);

    // pending suspensions should be cleared after resume
    const ds = session.displayState.get();
    expect(ds.pendingSuspensions.size).toBe(0);
  });

  it('should forward requireToolApproval=false to sendStreamResume when harness is in yolo mode', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const resumeData = context?.agent?.resumeData ?? context?.workflow?.resumeData ?? context?.resumeData;
        if (resumeData) {
          return { result: `Action "${input.action}" confirmed`, resumed: resumeData };
        }
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-yolo-resume',
      name: 'Test Agent Yolo Resume',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: (() => {
          let callCount = 0;
          return async () => {
            callCount++;
            return { stream: callCount === 1 ? createToolCallStream() : createTextStream() };
          };
        })(),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-yolo-resume': agent },
      logger: false,
      storage,
    });

    const registeredAgent = mastra.getAgent('test-agent-yolo-resume');

    const harness = new Harness({
      id: 'test-harness-yolo-resume',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });

    await harness.init();
    const session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const events: any[] = [];
    session.subscribe(event => {
      events.push(event);
    });
    await session.thread.create();

    await session.sendMessage({ content: 'Deploy to production' });

    const originalSendStreamResume = registeredAgent.sendStreamResume.bind(registeredAgent);
    const sendStreamResumeSpy = vi
      .spyOn(registeredAgent, 'sendStreamResume')
      .mockImplementation(options => originalSendStreamResume(options));

    await session.respondToToolSuspension({ resumeData: { confirmed: true } });

    expect(sendStreamResumeSpy).toHaveBeenCalled();
    const [resumeOptions] = sendStreamResumeSpy.mock.calls[0] as [any];
    // Yolo mode should disable tool approval gating on resume, matching sendMessage's behavior
    expect(resumeOptions.streamOptions.requireToolApproval).toBe(false);
  });

  it('should forward the full run budget (maxSteps) to sendStreamResume so the resumed run does not stop mid-task', async () => {
    // Regression: resumed streams previously omitted maxSteps, so the resumed run
    // merged over the agent's small default budget and ended with reason
    // "complete" after a few steps — the agent stopped mid-task after ask_user.
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        // Resume-aware: continue instead of re-suspending once resumeData arrives,
        // so the resumed run can actually complete.
        const resumeData = context?.agent?.resumeData ?? context?.workflow?.resumeData ?? context?.resumeData;
        if (resumeData) {
          return { result: `Action "${input.action}" confirmed`, resumed: resumeData };
        }
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-budget-resume',
      name: 'Test Agent Budget Resume',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: (() => {
          let callCount = 0;
          return async () => {
            callCount++;
            return { stream: callCount === 1 ? createToolCallStream() : createTextStream() };
          };
        })(),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-budget-resume': agent },
      logger: false,
      storage,
    });

    const registeredAgent = mastra.getAgent('test-agent-budget-resume');
    const sendStreamResumeSpy = vi.spyOn(registeredAgent, 'sendStreamResume');

    const harness = new Harness({
      id: 'test-harness-budget-resume',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });

    await harness.init();
    const session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });
    await session.thread.create();

    await session.sendMessage({ content: 'Deploy to production' });
    await session.respondToToolSuspension({ resumeData: { confirmed: true } });

    expect(sendStreamResumeSpy).toHaveBeenCalled();
    const [resumeOptions] = sendStreamResumeSpy.mock.calls[0] as [any];
    // Must match the budget used for the initial stream, not the agent default.
    expect(resumeOptions.streamOptions.maxSteps).toBe(1000);
    expect(resumeOptions.streamOptions.savePerStep).toBe(false);
    expect(resumeOptions.streamOptions.modelSettings).toBeUndefined();
  });
});
