/**
 * Tests for controller tool suspension and resumption.
 *
 * When a tool calls suspend() during execution, the controller should:
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

import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';

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

describe('AgentController: tool suspension and resumption', () => {
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

    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller-default-model-settings',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
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

    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
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

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

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

    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller-ds',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
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

    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller-resume',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

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

  it('should forward requireToolApproval=false to sendStreamResume when controller is in yolo mode', async () => {
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

    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller-yolo-resume',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
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

    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller-budget-resume',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
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

describe('AgentController: tool resume that fails before its run starts', () => {
  // MastraLanguageModelV2Mock: these cases need the resumed model call held open
  // on demand, which the aimock loop harness cannot do.
  async function suspendedSession(id: string, { gate }: { gate?: Promise<void> } = {}) {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const resumeData = context?.agent?.resumeData ?? context?.workflow?.resumeData ?? context?.resumeData;
        if (resumeData) return { result: `Action "${input.action}" confirmed` };
        await context.agent.suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });
    let callCount = 0;
    const agent = new Agent({
      id,
      name: id,
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => {
          if (++callCount === 1) return { stream: createToolCallStream() };
          await gate;
          return { stream: createTextStream() };
        },
      }),
      tools: { confirmAction: confirmTool },
    });
    const storage = new InMemoryStore();
    const mastra = new Mastra({ agents: { [id]: agent }, logger: false, storage });
    const registeredAgent = mastra.getAgent(id);
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: `${id}-controller`,
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    const events: any[] = [];
    session.subscribe(event => events.push(event));
    await session.thread.create();
    await session.sendMessage({ content: 'Deploy to production' });
    expect(session.displayState.get().pendingSuspensions.size).toBe(1);
    expect(session.run.isRunning()).toBe(false);
    return { session, events, agent: registeredAgent };
  }

  function holdModel() {
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    return { gate, release };
  }

  it('leaves the session idle with the tool call still parked, so a retry resumes it', async () => {
    const { session, events, agent } = await suspendedSession('test-agent-failed-resume');
    vi.spyOn(agent, 'sendStreamResume').mockRejectedValueOnce(new Error('resume dispatch failed'));
    events.length = 0;

    await session.respondToToolSuspension({ resumeData: { confirmed: true } });

    expect(events.some((e: any) => e.type === 'error')).toBe(true);
    expect(events.some((e: any) => e.type === 'agent_end')).toBe(false);
    expect(session.run.isRunning()).toBe(false);
    expect(session.run.getRunId()).toBeNull();
    expect(session.displayState.get().pendingSuspensions.size).toBe(1);

    events.length = 0;
    await session.respondToToolSuspension({ resumeData: { confirmed: true } });

    expect(events.find((e: any) => e.type === 'agent_end')?.reason).toBe('complete');
    expect(session.displayState.get().pendingSuspensions.size).toBe(0);
  });

  it('keeps the run the resume started when the answer rejects after it started', async () => {
    const model = holdModel();
    const { session, events, agent } = await suspendedSession('test-agent-resume-started', model);
    const resume = agent.sendStreamResume.bind(agent);
    let startedRunId: string | null = null;
    vi.spyOn(agent, 'sendStreamResume').mockImplementationOnce(async (...args) => {
      await resume(...args);
      await vi.waitFor(() => expect(session.run.getRunId()).not.toBeNull());
      startedRunId = session.run.getRunId();
      throw new Error('resume acknowledgement lost');
    });
    events.length = 0;

    await session.respondToToolSuspension({ resumeData: { confirmed: true } });

    expect(events.some((e: any) => e.type === 'error')).toBe(true);
    expect(session.run.isRunning()).toBe(true);
    expect(session.run.getRunId()).toBe(startedRunId);

    model.release();
    await vi.waitFor(() => expect(events.find((e: any) => e.type === 'agent_end')?.reason).toBe('complete'));
    expect(session.run.isRunning()).toBe(false);
  });

  it('keeps a run a message armed when a resume fails to start', async () => {
    const { session, events, agent } = await suspendedSession('test-agent-failed-resume-armed');
    const sent = session.sendMessage({ content: 'What is the status?' });
    await vi.waitFor(() => expect(session.run.isRunning()).toBe(true));
    const messageSignal = session.run.getAbortSignal();
    vi.spyOn(agent, 'sendStreamResume').mockRejectedValueOnce(new Error('resume dispatch failed'));

    await session.respondToToolSuspension({ resumeData: { confirmed: true } });

    expect(session.run.isRunning()).toBe(true);
    expect(session.run.getAbortSignal()).toBe(messageSignal);

    await sent;
    events.length = 0;
    await session.respondToToolSuspension({ resumeData: { confirmed: true } });
    await vi.waitFor(() => expect(events.find((e: any) => e.type === 'agent_end')?.reason).toBe('complete'));
    expect(session.displayState.get().pendingSuspensions.size).toBe(0);
  });

  it('keeps the run when a message arms it while the resume is failing', async () => {
    const { session, events, agent } = await suspendedSession('test-agent-failed-resume-joined');
    let sent: Promise<void> | undefined;
    vi.spyOn(agent, 'sendStreamResume').mockImplementationOnce(async () => {
      const armCount = session.run.armCount();
      sent = session.sendMessage({ content: 'What is the status?' });
      await vi.waitFor(() => expect(session.run.armCount()).toBeGreaterThan(armCount));
      throw new Error('resume dispatch failed');
    });

    await session.respondToToolSuspension({ resumeData: { confirmed: true } });

    expect(session.run.isRunning()).toBe(true);

    await sent;
    events.length = 0;
    await session.respondToToolSuspension({ resumeData: { confirmed: true } });
    await vi.waitFor(() => expect(events.find((e: any) => e.type === 'agent_end')?.reason).toBe('complete'));
    expect(session.displayState.get().pendingSuspensions.size).toBe(0);
  });
});
