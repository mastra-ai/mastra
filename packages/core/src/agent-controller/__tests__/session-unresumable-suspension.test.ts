/**
 * A parked tool call whose run can no longer be resumed (the agent consumed or
 * lost the suspended run) must not stay on screen. Answering it fails with
 * AGENT_SEND_STREAM_RESUME_NO_SUSPENDED_THREAD_RUN; every prompt parked on that
 * run is retracted with `tool_suspension_cancelled`, prompts parked on other
 * runs stay, and the next message starts a fresh run.
 */
import { describe, it, expect, vi } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';

import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';

vi.setConfig({ testTimeout: 30_000 });

function createToolCallStream(toolName: string, input: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'tool-call', toolCallId: 'call-1', toolName, input, providerExecuted: false });
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
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Done.' });
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

function suspendingTool(id: string) {
  return createTool({
    id,
    description: `Suspends until answered (${id})`,
    inputSchema: z.object({ text: z.string() }),
    execute: async (input: { text: string }, context?: any) => {
      const resumeData = context?.agent?.resumeData ?? context?.workflow?.resumeData ?? context?.resumeData;
      if (resumeData) return { result: input.text, resumed: resumeData };
      const suspend = context?.suspend ?? context?.agent?.suspend;
      if (!suspend) throw new Error('suspend not available in context');
      await suspend({ text: input.text });
      return { result: input.text };
    },
  });
}

async function setup(toolName: string) {
  const agent = new Agent({
    id: 'unresumable-agent',
    name: 'Unresumable Agent',
    instructions: 'Use the tool.',
    model: new MastraLanguageModelV2Mock({
      doStream: async ({ prompt }) => ({
        stream: JSON.stringify(prompt).includes('Start over')
          ? createTextStream()
          : createToolCallStream('confirmAction', '{"text":"deploy"}'),
      }),
    }),
    tools: { confirmAction: suspendingTool('confirm-action') },
  });
  const storage = new InMemoryStore();
  const mastra = new Mastra({ agents: { 'unresumable-agent': agent }, logger: false, storage });
  const registeredAgent = mastra.getAgent('unresumable-agent');
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'unresumable-controller',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
    initialState: { yolo: true } as any,
  });
  await controller.init();
  const session = await controller.createSession({ id: 'session', ownerId: 'owner' });
  const events: any[] = [];
  session.subscribe(event => {
    events.push(event);
  });
  await session.thread.create();
  await session.sendMessage({ content: 'Go' });

  const parked = events.find(event => event.type === 'tool_suspended');
  expect(parked).toBeDefined();
  const threadId = session.thread.getId()!;
  const resourceId = session.identity.getResourceId();
  const suspension = session.suspensions.get({ toolCallId: parked.toolCallId })!;
  const runId = suspension.runId;

  // A sibling prompt parked on the same run, and one parked on a different run.
  const sibling = { resourceId, threadId, runId, toolCallId: 'same-run-sibling' };
  const otherRun = { resourceId, threadId, runId: 'other-run', toolCallId: 'other-run-call' };
  for (const address of [sibling, otherRun]) {
    session.suspensions.register({ ...address, toolName: 'ask_user' });
    session.emit({
      type: 'tool_suspended',
      ...address,
      toolName: 'ask_user',
      args: {},
      suspendPayload: {},
      resumeSchema: undefined,
    } as any);
  }

  if (toolName === 'submit_plan') {
    // Answer it as a plan prompt so the reply takes the plan-approval path.
    session.suspensions.register({ ...suspension, toolName: 'submit_plan' });
  }

  // Another runtime answered the suspended run (e.g. a reply that completed on
  // the server after its client timed out). This session never observed that, so
  // it still shows the prompt, but the agent has nothing left to resume.
  const resumeError = new MastraError({
    id: 'AGENT_SEND_STREAM_RESUME_NO_SUSPENDED_THREAD_RUN',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text: `Agent "${registeredAgent.name}" sendStreamResume() could not find a suspended run "${runId}" for thread "${threadId}".`,
    details: { threadId, resourceId, runId, agentName: registeredAgent.name },
  });
  const sendStreamResume = vi.spyOn(registeredAgent, 'sendStreamResume').mockRejectedValueOnce(resumeError);
  events.length = 0;

  // The other runtime's resume also released the run here; do that once the
  // answer has failed, so it can't hide the session's own handling of the error.
  const releaseRun = async () => {
    registeredAgent.abortRunStream(runId);
    await new Promise(resolve => setTimeout(resolve, 10));
  };

  return { session, events, parked, runId, otherRun, sendStreamResume, releaseRun, registeredAgent };
}

describe('AgentController: answering a prompt whose run can no longer be resumed', () => {
  it.each([
    { toolName: 'confirmAction', resumeData: { confirmed: true } },
    { toolName: 'submit_plan', resumeData: { action: 'rejected', feedback: 'where are you at?' } },
    { toolName: 'submit_plan', resumeData: { action: 'approved' } },
  ])('retracts every prompt on the run ($toolName, $resumeData)', async ({ toolName, resumeData }) => {
    const { session, events, parked, runId, otherRun, sendStreamResume, releaseRun } = await setup(toolName);

    const shown = [...session.displayState.get().pendingSuspensions.values()].map(prompt => prompt.toolCallId);
    expect(shown.sort()).toEqual([parked.toolCallId, 'other-run-call', 'same-run-sibling'].sort());
    await session.respondToToolSuspension({ toolCallId: parked.toolCallId, resumeData });

    const resumeError = events.find(event => event.type === 'error')?.error;
    expect(resumeError?.message).toContain(`could not find a suspended run "${runId}"`);
    expect(resumeError?.id).toBe('AGENT_SEND_STREAM_RESUME_NO_SUSPENDED_THREAD_RUN');
    const cancelled = events.filter(event => event.type === 'tool_suspension_cancelled');
    expect(cancelled).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolCallId: parked.toolCallId,
          toolName,
          runId,
          reason: resumeError.message,
        }),
        expect.objectContaining({
          toolCallId: 'same-run-sibling',
          toolName: 'ask_user',
          runId,
          reason: resumeError.message,
        }),
      ]),
    );
    expect(cancelled).toHaveLength(2);
    expect(events.some(event => event.type === 'tool_suspended')).toBe(false);
    // The gone run ends as failed rather than staying parked.
    expect(events.filter(event => event.type === 'agent_end')).toEqual([{ type: 'agent_end', reason: 'error' }]);

    // Only the other run's prompt remains, in both the suspension store and the display state.
    expect(session.suspensions.has({ toolCallId: parked.toolCallId })).toBe(false);
    expect(session.suspensions.has({ toolCallId: 'same-run-sibling' })).toBe(false);
    expect(session.suspensions.has(otherRun)).toBe(true);
    const prompts = [...session.displayState.get().pendingSuspensions.values()];
    expect(prompts.map(prompt => prompt.toolCallId)).toEqual(['other-run-call']);

    // Drop the unrelated prompt so the next message isn't routed as its answer.
    session.suspensions.delete(otherRun);
    expect(session.suspensions.hasPending()).toBe(false);

    await releaseRun();
    events.length = 0;
    await session.sendMessage({ content: 'Start over' });

    // The next message starts a run of its own instead of resuming the gone one.
    expect(sendStreamResume).toHaveBeenCalledTimes(1);
    expect(events.some(event => event.type === 'agent_start')).toBe(true);
    expect(events.some(event => event.type === 'agent_end' && event.reason === 'complete')).toBe(true);
    expect(events.some(event => event.type === 'error')).toBe(false);
  });

  it('keeps a prompt on the same run that the agent still holds', async () => {
    const { session, events, parked, runId, registeredAgent } = await setup('confirmAction');
    // Another runtime answered only the parked call; the run still waits on its sibling.
    vi.spyOn(registeredAgent, 'listSuspendedRuns').mockResolvedValue({
      runs: [{ runId, toolCalls: [{ toolCallId: 'same-run-sibling', toolName: 'ask_user' }] }],
    } as any);

    await session.respondToToolSuspension({ toolCallId: parked.toolCallId, resumeData: { confirmed: true } });

    const cancelled = events.filter(event => event.type === 'tool_suspension_cancelled');
    expect(cancelled.map(event => event.toolCallId)).toEqual([parked.toolCallId]);
    expect(session.suspensions.has({ toolCallId: 'same-run-sibling', runId })).toBe(true);
    const prompts = [...session.displayState.get().pendingSuspensions.values()].map(prompt => prompt.toolCallId);
    expect(prompts.sort()).toEqual(['other-run-call', 'same-run-sibling']);
    // The run stays parked for the call it still holds.
    expect(events.some(event => event.type === 'agent_end')).toBe(false);
  });

  it('keeps the other prompts on the run when storage cannot say which calls the agent holds', async () => {
    const { session, events, parked, runId, registeredAgent } = await setup('confirmAction');
    vi.spyOn(registeredAgent, 'listSuspendedRuns').mockRejectedValue(new Error('storage unavailable'));

    await session.respondToToolSuspension({ toolCallId: parked.toolCallId, resumeData: { confirmed: true } });

    const cancelled = events.filter(event => event.type === 'tool_suspension_cancelled');
    expect(cancelled.map(event => event.toolCallId)).toEqual([parked.toolCallId]);
    expect(session.suspensions.has({ toolCallId: 'same-run-sibling', runId })).toBe(true);
    const prompts = [...session.displayState.get().pendingSuspensions.values()].map(prompt => prompt.toolCallId);
    expect(prompts.sort()).toEqual(['other-run-call', 'same-run-sibling']);
    expect(events.some(event => event.type === 'agent_end')).toBe(false);
  });
});
