/**
 * Tests for harness tool suspension and resumption.
 *
 * When a tool calls suspend() during execution, the harness should:
 *   1. Emit a 'tool_suspended' event to subscribers
 *   2. Report agent_end with reason 'suspended'
 *   3. Allow the caller to resume via respondToToolSuspension()
 *   4. Call agent.resumeStream() and continue processing
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

    // Collect all events
    const events: any[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.createThread();

    // Send a message — the tool should execute and call suspend()
    await harness.sendMessage({ content: 'Deploy to production' });

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

  it('should set pendingSuspension display state when tool suspends', async () => {
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
    await harness.createThread();
    await harness.sendMessage({ content: 'Do it' });

    const ds = harness.getDisplayState();
    expect(ds.pendingSuspension).not.toBeNull();
    expect(ds.pendingSuspension!.toolName).toBe('confirmAction');
    expect(ds.pendingSuspension!.suspendPayload).toEqual({ action: 'deploy' });
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

    const events: any[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.createThread();

    // First message triggers suspension
    await harness.sendMessage({ content: 'Deploy to production' });

    const suspendEnd = events.find((e: any) => e.type === 'agent_end');
    expect(suspendEnd?.reason).toBe('suspended');

    // Clear events for resume phase
    events.length = 0;

    // Resume with data
    await harness.respondToToolSuspension({ resumeData: { confirmed: true } });

    // Should emit agent_start + agent_end(complete) for the resumed run
    const resumeStart = events.find((e: any) => e.type === 'agent_start');
    expect(resumeStart).toBeDefined();

    const resumeEnd = events.find((e: any) => e.type === 'agent_end');
    expect(resumeEnd).toBeDefined();
    expect(resumeEnd.reason).toBe('complete');

    // pendingSuspension should be cleared after resume
    const ds = harness.getDisplayState();
    expect(ds.pendingSuspension).toBeNull();
  });

  it('should forward requireToolApproval=false to resumeStream when harness is in yolo mode', async () => {
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

    const resumeStreamSpy = vi.spyOn(registeredAgent, 'resumeStream');

    const harness = new Harness({
      id: 'test-harness-yolo-resume',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });

    await harness.init();
    await harness.createThread();

    await harness.sendMessage({ content: 'Deploy to production' });
    await harness.respondToToolSuspension({ resumeData: { confirmed: true } });

    expect(resumeStreamSpy).toHaveBeenCalled();
    const [, resumeOptions] = resumeStreamSpy.mock.calls[0] as [any, any];
    // Yolo mode should disable tool approval gating on resume, matching sendMessage's behavior
    expect(resumeOptions.requireToolApproval).toBe(false);
  });
});
