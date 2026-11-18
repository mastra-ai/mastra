/**
 * Regression tests for #30462: two continuations racing to resume one suspended
 * run must not both drive it, and the one that loses must not be reported as a
 * failure. Only the continuation that claims the run ends it and reports its
 * outcome; the loser produces no `error` event, ends no run, and leaves the
 * parked call answered by the winner instead of resurrecting its prompt.
 *
 * The durable layer already refuses the loser (see resume-claim-loser.test.ts),
 * so the failures covered here are the two ways that refusal used to reach the
 * user: both continuations resuming the call, and a lost claim being surfaced as
 * a session error on the losing side.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

vi.setConfig({ testTimeout: 30_000 });

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function stream(chunks: unknown[]) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function toolCallStream() {
  return stream([
    {
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'confirmAction',
      input: '{"action":"deploy"}',
      providerExecuted: false,
    },
    { type: 'finish', finishReason: 'tool-calls', usage },
  ]);
}

function textStream(text = 'Deployed successfully.') {
  return stream([
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: text },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop', usage },
  ]);
}

/**
 * A tool that parks itself the first time it runs and finishes when the call is
 * resumed, so a resumed call that runs again is visible in `executions`.
 */
async function createHarness(id: string) {
  const executions: unknown[] = [];
  const confirmTool = createTool({
    id: 'confirm-action',
    description: 'Confirms an action with the user',
    inputSchema: z.object({ action: z.string() }),
    execute: async (input: { action: string }, context?: any) => {
      const resumeData = context?.resumeData ?? context?.agent?.resumeData ?? context?.workflow?.resumeData;
      if (resumeData) {
        executions.push(resumeData);
        return { result: `Action "${input.action}" confirmed` };
      }
      const suspend = context?.suspend ?? context?.agent?.suspend;
      if (!suspend) throw new Error('suspend not available in context');
      await suspend({ action: input.action });
      return { result: `Action "${input.action}" confirmed` };
    },
  });

  let modelCalls = 0;
  const agent = new Agent({
    id: `${id}-agent`,
    name: `${id} agent`,
    instructions: 'You confirm actions.',
    model: new MastraLanguageModelV2Mock({
      doStream: async () => {
        modelCalls++;
        return { stream: modelCalls === 1 ? toolCallStream() : textStream() };
      },
    }),
    tools: { confirmAction: confirmTool },
  });

  const storage = new InMemoryStore();
  const mastra = new Mastra({ agents: { [`${id}-agent`]: agent }, logger: false, storage });
  const registeredAgent = mastra.getAgent(`${id}-agent`);
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: `${id}-controller`,
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
    initialState: { yolo: true } as any,
  });
  await controller.init();
  const session = await controller.createSession({ id: `${id}-session`, ownerId: 'owner-1' });
  await session.thread.create();

  const events: AgentControllerEvent[] = [];
  session.subscribe(event => {
    events.push(event);
  });

  return { session, agent: registeredAgent, events, executions, modelCalls: () => modelCalls };
}

/** Run the message that parks `confirmAction`, and return the parked address. */
async function park(harness: Awaited<ReturnType<typeof createHarness>>) {
  const { session, events } = harness;
  await session.sendMessage({ content: 'Deploy to production' });
  expect(events.filter(event => event.type === 'agent_end').map(event => event.reason)).toEqual(['suspended']);

  let address: ReturnType<typeof session.suspensions.resolveAddress>;
  await vi.waitFor(() => {
    address = session.suspensions.resolveAddress({ toolCallId: 'call-1' });
    expect(address).toBeDefined();
  });
  return address!;
}

/** The durable layer's verdict that another continuation claimed the run. */
function lostClaimError() {
  return new MastraError({
    id: 'AGENT_RESUME_ALREADY_CLAIMED',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    text: 'Agent "confirm" cannot resume run "run-1" because another resume of it already claimed it.',
  });
}

describe('two continuations resuming one parked tool call (#30462)', () => {
  it('Given one parked call, When two answers arrive together, Then only one resumes the call and neither reports a failure', async () => {
    const harness = await createHarness('two-answers');
    const { session, agent, events, executions } = harness;
    await park(harness);
    const resumedFrom = events.length;
    const sendStreamResume = vi.spyOn(agent, 'sendStreamResume');

    const answers = await Promise.allSettled([
      session.respondToToolSuspension({ toolCallId: 'call-1', resumeData: { confirmed: true } }),
      session.respondToToolSuspension({ toolCallId: 'call-1', resumeData: { confirmed: true } }),
    ]);

    expect(answers.map(answer => answer.status)).toEqual(['fulfilled', 'fulfilled']);
    // One resume reached the agent: the second answer joins the first instead of racing it.
    expect(sendStreamResume).toHaveBeenCalledTimes(1);
    expect(executions).toHaveLength(1);

    await vi.waitFor(() =>
      expect(events.slice(resumedFrom).some(event => event.type === 'agent_end' && event.reason === 'complete')).toBe(
        true,
      ),
    );
    const resumed = events.slice(resumedFrom);
    expect(resumed.filter(event => event.type === 'agent_start')).toHaveLength(1);
    expect(resumed.some(event => event.type === 'error')).toBe(false);
    expect(session.suspensions.hasPending()).toBe(false);
    expect(session.run.isRunning()).toBe(false);
  });

  it('Given a parked call, When the resume loses the run to another continuation, Then the loss is not reported as a failure and the call stays answered', async () => {
    const harness = await createHarness('lost-claim');
    const { session, agent, events } = harness;
    const parked = await park(harness);
    const resumedFrom = events.length;
    const sendStreamResume = vi.spyOn(agent, 'sendStreamResume').mockRejectedValueOnce(lostClaimError());

    await expect(
      session.respondToToolSuspension({ toolCallId: parked.toolCallId, resumeData: { confirmed: true } }),
    ).resolves.toBeUndefined();

    expect(sendStreamResume).toHaveBeenCalledTimes(1);
    const resumed = events.slice(resumedFrom);
    expect(resumed.some(event => event.type === 'error')).toBe(false);
    expect(resumed.some(event => event.type === 'agent_end')).toBe(false);
    // The winner answered the call, so this session must not park it again.
    expect(session.suspensions.has(parked)).toBe(false);
    expect(session.displayState.get().pendingSuspensions.size).toBe(0);
    expect(session.run.isRunning()).toBe(false);
  });

  it('Given a parked call, When the resume fails for any other reason, Then the failure is still reported and the call is parked again', async () => {
    const harness = await createHarness('other-failure');
    const { session, agent, events } = harness;
    const parked = await park(harness);
    const resumedFrom = events.length;
    vi.spyOn(agent, 'sendStreamResume').mockRejectedValueOnce(new Error('dispatch failed'));

    await session.respondToToolSuspension({ toolCallId: parked.toolCallId, resumeData: { confirmed: true } });

    const resumed = events.slice(resumedFrom);
    expect(resumed.some(event => event.type === 'error' && (event as any).error.message === 'dispatch failed')).toBe(
      true,
    );
    expect(session.suspensions.has(parked)).toBe(true);
  });
});
