import { stepCountIs } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import type { Processor } from '../../../../processors';
import { StreamErrorRetryProcessor } from '../../../../processors';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  runApprovalScenario,
  runLoopScenario,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * A team bills customers from the token usage on an agent result. A dropped connection forces a
 * retry, the retry succeeds, and the result must still give them a number to bill.
 *
 * `usage` and `totalUsage` stay unknown on the normal and fs engines because the failed attempt may
 * have cost tokens nobody reported. `observedUsage` is the sum of what was reported, and
 * `incomplete` says whether that sum can be missing something. The durable family hides the failed
 * attempt, so its `totalUsage` looks complete and `incomplete` is false.
 *
 * The drop is a real socket reset (`disconnectAfterMs`). Aimock fills omitted counters with 0, so
 * only a socket drop gives a report with no counts.
 */

const CUT_OFF_REPLY = 'Your order shipped yesterday and should arrive by Friday, tracking number';
const FULL_REPLY = 'Your order #4821 shipped yesterday and arrives Friday.';
const midStreamDrop = { chunkSize: 5, latency: 20, disconnectAfterMs: 150 };
// Same processor id as the shipped default, so it replaces it; the default waits 3s before retrying.
const retryWithoutBackoff = () => [new StreamErrorRetryProcessor({ maxRetries: 2 })];

const TOOL_STEP = { input_tokens: 13, output_tokens: 7 };
const FINAL_STEP = { input_tokens: 10, output_tokens: 5 };
const TOOL_THEN_FINAL = { inputTokens: 23, outputTokens: 12, totalTokens: 35 };
const REPLY_STEP = { input_tokens: 100, output_tokens: 20 };
const ONE_REPLY = { inputTokens: 100, outputTokens: 20, totalTokens: 120 };
const THREE_REPLIES = { inputTokens: 300, outputTokens: 60, totalTokens: 360 };
const UNKNOWN = { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };

const counts = (usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined) => ({
  inputTokens: usage?.inputTokens,
  outputTokens: usage?.outputTokens,
  totalTokens: usage?.totalTokens,
});

const lookupOrder = createTool({
  id: 'lookupOrder',
  description: 'Look up an order by id.',
  inputSchema: z.object({ orderId: z.string() }),
  execute: async ({ orderId }) => ({ orderId, status: 'shipped' }),
});

describeForAllEngines('Reading token usage after a retry recovers a call', engine => {
  const getMock = useLoopScenarioAimock();
  const hidesFailedAttempt = isDurableEngineVariant(engine);

  it('a reply cut off and retried reports the counts of the attempt that finished', async () => {
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Where is my order #4821?',
      errorProcessors: retryWithoutBackoff(),
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: CUT_OFF_REPLY }, midStreamDrop);
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: FULL_REPLY, usage: REPLY_STEP });
      },
    });

    const observed = await output.observedUsage;
    expect(counts(observed)).toEqual(ONE_REPLY);
    expect(observed.incomplete).toBe(!hidesFailedAttempt);
    expect(counts(await output.totalUsage)).toEqual(hidesFailedAttempt ? ONE_REPLY : UNKNOWN);

    const full = await output.getFullOutput();
    expect(counts(full.observedUsage)).toEqual(ONE_REPLY);
    expect(full.observedUsage.incomplete).toBe(!hidesFailedAttempt);
    expect(counts(full.totalUsage)).toEqual(hidesFailedAttempt ? ONE_REPLY : UNKNOWN);
    expect(full.text).toBe(FULL_REPLY);
  });

  // A cut stream cannot reach the plain engine's generate(), which reads one whole response.
  it('generate() returns the counts of the attempt that finished after a failed request', async () => {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', sequenceIndex: 0 },
      { error: { message: 'overloaded', type: 'server_error' }, status: 503 },
    );
    llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: FULL_REPLY, usage: REPLY_STEP });
    const { agent } = await createSharedAgent(llm, { engine, errorProcessors: retryWithoutBackoff() });

    const result = await agent.generate('Where is my order #4821?');

    expect(result.text).toBe(FULL_REPLY);
    expect(counts(result.observedUsage)).toEqual(ONE_REPLY);
    expect(result.observedUsage.incomplete).toBe(!hidesFailedAttempt);
    expect(counts(result.totalUsage)).toEqual(hidesFailedAttempt ? ONE_REPLY : UNKNOWN);
  });

  // Gemini counts thinking in its total, so the total is more than input plus output.
  it('a retried reply keeps a reported total that holds more than input and output', async () => {
    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error('overloaded'), { isRetryable: true });
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: FULL_REPLY },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 100, outputTokens: 20, totalTokens: 150, reasoningTokens: 30 },
            },
          ]),
        };
      },
    });

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      model,
      prompt: 'Where is my order #4821?',
      errorProcessors: retryWithoutBackoff(),
      fixtures: () => {},
    });

    expect(counts(await output.observedUsage)).toEqual({ inputTokens: 100, outputTokens: 20, totalTokens: 150 });
    expect((await output.observedUsage).reasoningTokens).toBe(30);
  });

  it('a reply cut off after an order lookup adds the lookup step and the final reply', async () => {
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Where is my order #4821?',
      tools: { lookupOrder },
      stopWhen: stepCountIs(5),
      errorProcessors: retryWithoutBackoff(),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ name: 'lookupOrder', arguments: JSON.stringify({ orderId: '4821' }) }],
            usage: TOOL_STEP,
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true, sequenceIndex: 0 }, { content: CUT_OFF_REPLY }, midStreamDrop);
        llm.on({ endpoint: 'chat', hasToolResult: true, sequenceIndex: 1 }, { content: FULL_REPLY, usage: FINAL_STEP });
      },
    });

    const observed = await output.observedUsage;
    expect(counts(observed)).toEqual(TOOL_THEN_FINAL);
    expect(observed.incomplete).toBe(!hidesFailedAttempt);
    expect(counts(await output.totalUsage)).toEqual(hidesFailedAttempt ? TOOL_THEN_FINAL : UNKNOWN);
  });

  it('a run with no failure reports the same counts as totalUsage and is not incomplete', async () => {
    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Where is my order #4821?',
      tools: { lookupOrder },
      stopWhen: stepCountIs(5),
      errorProcessors: retryWithoutBackoff(),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [{ name: 'lookupOrder', arguments: JSON.stringify({ orderId: '4821' }) }],
            usage: TOOL_STEP,
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: FULL_REPLY, usage: FINAL_STEP });
      },
    });

    const observed = await output.observedUsage;
    expect(counts(observed)).toEqual(TOOL_THEN_FINAL);
    expect(counts(await output.totalUsage)).toEqual(TOOL_THEN_FINAL);
    expect(observed.incomplete).toBe(false);
  });

  it('a reply cut off before an approval keeps counting through the resume', async () => {
    const { output, approvals } = await runApprovalScenario({
      engine,
      llm: getMock(),
      prompt: 'Where is my order #4821?',
      tools: { lookupOrder },
      stopWhen: stepCountIs(5),
      errorProcessors: retryWithoutBackoff(),
      decision: () => true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', hasToolResult: false, sequenceIndex: 0 }, { content: CUT_OFF_REPLY }, midStreamDrop);
        llm.on(
          { endpoint: 'chat', hasToolResult: false, sequenceIndex: 1 },
          {
            toolCalls: [{ id: 'call-lookup', name: 'lookupOrder', arguments: JSON.stringify({ orderId: '4821' }) }],
            usage: TOOL_STEP,
          },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: FULL_REPLY, usage: FINAL_STEP });
      },
    });

    expect(approvals).toEqual(['approve:call-lookup']);
    expect(await output.text).toContain(FULL_REPLY);
    const observed = await output.observedUsage;
    expect(counts(observed)).toEqual(TOOL_THEN_FINAL);
    expect(observed.incomplete).toBe(!hidesFailedAttempt);
    expect(counts(await output.totalUsage)).toEqual(hidesFailedAttempt ? TOOL_THEN_FINAL : UNKNOWN);
  });

  async function expectThreeGoalTurnsCounted({ cutFirstTurn }: { cutFirstTurn: boolean }) {
    let evaluations = 0;
    const scorer = {
      id: 'goal-scorer',
      name: 'Goal Scorer',
      run: async () => {
        evaluations += 1;
        return evaluations < 3 ? { score: 0, reason: 'Goal not yet achieved' } : { score: 1, reason: 'Goal achieved' };
      },
    };

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Implement feature X',
      memory: new MockMemory(),
      threadId: `goal-usage-${cutFirstTurn ? 'cut' : 'clean'}`,
      resourceId: 'user-1',
      goal: { judge: 'gpt-4', maxRuns: 5, scorer },
      objective: 'Implement feature X',
      errorProcessors: retryWithoutBackoff(),
      stopWhen: ({ step }: { step: number }) => step > 8,
      fixtures: llm => {
        let index = 0;
        if (cutFirstTurn) {
          llm.on({ endpoint: 'chat', sequenceIndex: index++ }, { content: CUT_OFF_REPLY }, midStreamDrop);
        }
        for (const content of ['First turn.', 'Second turn.', 'Third turn.']) {
          llm.on({ endpoint: 'chat', sequenceIndex: index++ }, { content, usage: REPLY_STEP });
        }
      },
    });

    const full = await output.getFullOutput();
    expect(full.steps.map(step => counts(step.usage))).toEqual([ONE_REPLY]);
    expect(counts(full.observedUsage)).toEqual(THREE_REPLIES);
    const incomplete = cutFirstTurn && !hidesFailedAttempt;
    expect(full.observedUsage.incomplete).toBe(incomplete);
    expect(counts(full.totalUsage)).toEqual(incomplete ? UNKNOWN : THREE_REPLIES);
  }

  it('a goal run of three turns counts every turn, not only the last one', () =>
    expectThreeGoalTurnsCounted({ cutFirstTurn: false }));

  it('a goal run with a cut reply in its first turn still counts every turn', () =>
    expectThreeGoalTurnsCounted({ cutFirstTurn: true }));

  it('final-answer processors and onFinish see the same observed usage as the result', async () => {
    const seenByProcessor: unknown[] = [];
    const usageAudit: Processor = {
      id: 'usage-audit',
      processOutputResult: ({ messages, result }) => {
        seenByProcessor.push(result.observedUsage);
        return messages;
      },
    };
    const onFinish = vi.fn();

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Where is my order #4821?',
      errorProcessors: retryWithoutBackoff(),
      outputProcessors: [usageAudit],
      onFinish,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: CUT_OFF_REPLY }, midStreamDrop);
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: FULL_REPLY, usage: REPLY_STEP });
      },
    });

    const expected = { ...ONE_REPLY, incomplete: !hidesFailedAttempt };
    expect(await output.observedUsage).toMatchObject(expected);
    expect(seenByProcessor).toEqual([expect.objectContaining(expected)]);
    await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());
    expect(onFinish.mock.calls[0]![0].observedUsage).toMatchObject(expected);
  });
});
