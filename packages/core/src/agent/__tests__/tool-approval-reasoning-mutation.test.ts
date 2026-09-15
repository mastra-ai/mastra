/**
 * Reproduction + regression coverage for issue #19445:
 * "requireApproval resume mutates the latest assistant message — next turn 400s
 *  with Anthropic 'thinking blocks cannot be modified', thread permanently stuck"
 *
 * When a `requireApproval` tool call suspends, the partial assistant message
 * (reasoning + text + the pending tool-call) is flushed to storage. On resume,
 * the continuation (the approved/declined tool result AND the model's next
 * signed reasoning/text) used to be written back under the SAME messageId, so
 * the already-persisted assistant row was MUTATED in place — it ended up
 * holding the reasoning of two separate model responses.
 *
 * With Anthropic extended thinking that is fatal: the mutated row's thinking
 * blocks no longer correspond to a single original response, and the next turn
 * 400s with "thinking blocks in the latest assistant message cannot be
 * modified".
 *
 * The invariant these tests encode: the MODEL OUTPUT (reasoning + text) of an
 * assistant message that was already persisted at suspend time must be
 * IMMUTABLE across the resume. The one change that row is allowed is its own
 * pending tool call resolving in place — gaining the approval decision and,
 * when approved, the tool result. Everything the model produces after the
 * resume must land in its own fresh message row and must not carry that tool
 * result.
 *
 * @see https://github.com/mastra-ai/mastra/issues/19445
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import type { MastraDBMessage, MastraMessagePart, MastraToolInvocationPart } from '../message-list';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

const TOOL_CALL_ID = 'call-1';
// Anthropic reasoning-block signatures. In production these are cryptographic
// signatures the API validates; here they just need to be distinct so we can
// tell one model response's reasoning apart from another's.
const PRE_APPROVAL_SIGNATURE = 'sig-before-resume';
const POST_APPROVAL_SIGNATURE = 'sig-after-resume';
const FOLLOW_UP_SIGNATURE = 'sig-follow-up';

const USAGE = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

// ---------------------------------------------------------------------------
// Scripted-model chunk builders
// ---------------------------------------------------------------------------

function signedReasoning(id: string, signature: string, delta: string) {
  const providerMetadata = { anthropic: { signature } };
  return [
    { type: 'reasoning-start', id, providerMetadata },
    { type: 'reasoning-delta', id, delta, providerMetadata },
    { type: 'reasoning-end', id, providerMetadata },
  ];
}

function text(id: string, delta: string) {
  return [
    { type: 'text-start', id },
    { type: 'text-delta', id, delta },
    { type: 'text-end', id },
  ];
}

function toolCall() {
  return {
    type: 'tool-call',
    toolCallId: TOOL_CALL_ID,
    toolName: 'sensitive-op',
    input: '{"action":"do-it"}',
    providerExecuted: false,
  };
}

/** Assemble a full doStream chunk array for one model turn. */
function turn(
  responseId: string,
  parts: Array<Record<string, unknown>>,
  finishReason: 'tool-calls' | 'stop',
): Array<Record<string, unknown>> {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: responseId, modelId: 'mock-model-id', timestamp: new Date(0) },
    ...parts,
    { type: 'finish', finishReason, usage: USAGE },
  ];
}

/**
 * A model whose successive doStream calls replay `scripts` in order. The last
 * script is reused if the loop makes more calls than were scripted.
 */
function scriptedModel(scripts: Array<Array<Record<string, unknown>>>) {
  let index = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      const chunks = scripts[Math.min(index, scripts.length - 1)]!;
      index++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(chunks as any),
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Agent / flow helpers
// ---------------------------------------------------------------------------

const mockExecute = vi.fn().mockResolvedValue({ performed: true });

function buildAgent(model: MockLanguageModelV2) {
  const memory = new MockMemory();
  const agent = new Agent({
    id: 'approval-reasoning-agent',
    name: 'Approval Reasoning Agent',
    instructions: 'You are a test agent.',
    model,
    tools: {
      sensitiveTool: createTool({
        id: 'sensitive-op',
        description: 'Performs a sensitive operation requiring approval',
        inputSchema: z.object({ action: z.string() }),
        requireApproval: true,
        execute: async input => mockExecute(input) as Promise<Record<string, any>>,
      }),
    },
    memory,
  });
  const mastra = new Mastra({
    agents: { approvalReasoningAgent: agent },
    logger: false,
    storage: new InMemoryStore(),
  });
  return { agent: mastra.getAgent('approvalReasoningAgent'), memory };
}

async function streamUntilApproval(agent: Agent, threadId: string, prompt: string) {
  const stream = await agent.stream(prompt, {
    requireToolApproval: true,
    memory: { resource: 'user-1', thread: { id: threadId } },
  });
  let toolCallId = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-call-approval') {
      toolCallId = chunk.payload.toolCallId;
    }
  }
  return { stream, toolCallId };
}

async function drain(stream: { fullStream: AsyncIterable<unknown> }) {
  for await (const _chunk of stream.fullStream) {
    // consume so the turn persists
  }
}

/** The anthropic reasoning-block signatures on a row, in document order. */
function reasoningSignatures(message: MastraDBMessage): string[] {
  return (message.content.parts ?? [])
    .filter((part): part is Extract<MastraMessagePart, { type: 'reasoning' }> => part.type === 'reasoning')
    .map(part => part.providerMetadata?.anthropic?.signature)
    .filter((sig): sig is string => typeof sig === 'string');
}

/** The text the model emitted on a row, in document order. */
function assistantText(message: MastraDBMessage): string[] {
  return (message.content.parts ?? [])
    .filter((part): part is Extract<MastraMessagePart, { type: 'text' }> => part.type === 'text')
    .map(part => part.text);
}

/** The tool-invocation part for `toolCallId`, if this row owns it. */
function toolInvocation(message: MastraDBMessage, toolCallId: string): MastraToolInvocationPart | undefined {
  return (message.content.parts ?? []).find(
    (part): part is MastraToolInvocationPart =>
      part.type === 'tool-invocation' && part.toolInvocation.toolCallId === toolCallId,
  );
}

/**
 * The model's own output on a row — reasoning signatures + text. This is the
 * slice a resume must leave byte-for-byte identical. The row's pending tool
 * call resolving in place afterwards (gaining an approval + result) is a
 * separate, expected mutation and is deliberately excluded here.
 */
type ModelOutput = { reasoning: string[]; text: string[] };
function modelOutput(message: MastraDBMessage): ModelOutput {
  return { reasoning: reasoningSignatures(message), text: assistantText(message) };
}

async function loadAssistantRows(memory: MockMemory, threadId: string): Promise<MastraDBMessage[]> {
  const { messages } = await memory.recall({ threadId, perPage: false });
  return messages.filter(m => m.role === 'assistant');
}

/** Snapshot every assistant row's model output, keyed by message id. */
function snapshotModelOutput(assistant: MastraDBMessage[]): Map<string, ModelOutput> {
  return new Map(assistant.map(message => [message.id, modelOutput(message)] as const));
}

/**
 * Assert the resume produced a clean message boundary:
 *  - every row persisted at suspend time keeps its own model output verbatim;
 *  - the original row still owns the resolved tool call, with the right
 *    approval decision (and result, when approved);
 *  - none of the post-resume model output leaked back onto that row;
 *  - all post-resume model output lives on a single fresh row that carries no
 *    tool result of its own.
 */
function expectCleanResumeBoundary(params: {
  before: Map<string, ModelOutput>;
  after: MastraDBMessage[];
  preSignature: string;
  postSignature: string;
  postText: string;
  approval: { approved: boolean; state: string; hasResult: boolean };
}) {
  const { before, after, preSignature, postSignature, postText, approval } = params;

  // (1) Model output of every pre-suspend row is immutable across the resume.
  for (const [id, outputBefore] of before) {
    const rowAfter = after.find(message => message.id === id);
    expect(rowAfter, `assistant row ${id} should still exist after resume`).toBeDefined();
    expect(modelOutput(rowAfter!), `model output of assistant row ${id} was mutated by the resume`).toEqual(
      outputBefore,
    );
  }

  // (2) The original row still owns the tool call, now resolved. The approval
  //     decision and result must land here — not on the continuation row.
  const originalRow = after.find(
    message => before.has(message.id) && reasoningSignatures(message).includes(preSignature),
  );
  expect(originalRow, 'the pre-suspend row should survive the resume').toBeDefined();
  const resolvedCall = toolInvocation(originalRow!, TOOL_CALL_ID);
  expect(resolvedCall, 'the approved/declined tool call must stay on the original row').toBeDefined();
  expect(resolvedCall!.toolInvocation.state).toBe(approval.state);
  expect(resolvedCall!.toolInvocation.approval?.approved).toBe(approval.approved);
  expect(resolvedCall!.toolInvocation.result !== undefined).toBe(approval.hasResult);

  // (3) No post-resume model output leaked back onto the original row.
  expect(reasoningSignatures(originalRow!)).not.toContain(postSignature);
  expect(assistantText(originalRow!)).not.toContain(postText);

  // (4) The continuation is a single brand-new row that holds every bit of
  //     post-resume model output and no tool result of its own.
  const continuationRows = after.filter(message => !before.has(message.id));
  expect(continuationRows, 'the continuation must land in a new row').toHaveLength(1);
  const continuation = continuationRows[0]!;
  expect(reasoningSignatures(continuation)).toContain(postSignature);
  expect(assistantText(continuation)).toContain(postText);
  expect(
    toolInvocation(continuation, TOOL_CALL_ID),
    'the tool result must not be routed to the new row',
  ).toBeUndefined();
}

describe('issue #19445: requireApproval resume must not mutate the persisted assistant message', () => {
  beforeEach(() => mockExecute.mockClear());

  it('approve: keeps the pre-approval row immutable and puts the continuation in a new row', async () => {
    const model = scriptedModel([
      turn(
        'id-0',
        [
          ...signedReasoning('reasoning-1', PRE_APPROVAL_SIGNATURE, 'I should call the sensitive tool.'),
          ...text('text-1', 'Let me run that for you.'),
          toolCall(),
        ],
        'tool-calls',
      ),
      turn(
        'id-1',
        [
          ...signedReasoning('reasoning-2', POST_APPROVAL_SIGNATURE, 'The tool succeeded, summarizing.'),
          ...text('text-2', 'All done.'),
        ],
        'stop',
      ),
    ]);
    const { agent, memory } = buildAgent(model);
    const threadId = 'thread-approve';

    const { stream, toolCallId } = await streamUntilApproval(agent, threadId, 'Do the sensitive thing');
    expect(toolCallId).toBe(TOOL_CALL_ID);
    expect(mockExecute).toHaveBeenCalledTimes(0);

    const before = snapshotModelOutput(await loadAssistantRows(memory, threadId));
    expect([...before.values()].flatMap(output => output.reasoning)).toContain(PRE_APPROVAL_SIGNATURE);
    expect([...before.values()].flatMap(output => output.reasoning)).not.toContain(POST_APPROVAL_SIGNATURE);

    const resumed = await agent.approveToolCall({ runId: stream.runId, toolCallId });
    await drain(resumed);
    expect(mockExecute).toHaveBeenCalledTimes(1);

    const after = await loadAssistantRows(memory, threadId);

    // The original row keeps its own reasoning + text and the resolved tool
    // call (state `result`, approved, with the tool's output); the model's
    // post-approval reasoning and text move to a fresh row on their own.
    expectCleanResumeBoundary({
      before,
      after,
      preSignature: PRE_APPROVAL_SIGNATURE,
      postSignature: POST_APPROVAL_SIGNATURE,
      postText: 'All done.',
      approval: { approved: true, state: 'result', hasResult: true },
    });
  }, 30000);

  it('decline: keeps the pre-decline row immutable and puts the follow-up in a new row', async () => {
    const model = scriptedModel([
      turn(
        'id-0',
        [
          ...signedReasoning('reasoning-1', PRE_APPROVAL_SIGNATURE, 'I should call the sensitive tool.'),
          ...text('text-1', 'Let me run that for you.'),
          toolCall(),
        ],
        'tool-calls',
      ),
      turn(
        'id-1',
        [
          ...signedReasoning('reasoning-2', POST_APPROVAL_SIGNATURE, 'Okay, I will not run it.'),
          ...text('text-2', 'Understood, cancelled.'),
        ],
        'stop',
      ),
    ]);
    const { agent, memory } = buildAgent(model);
    const threadId = 'thread-decline';

    const { stream, toolCallId } = await streamUntilApproval(agent, threadId, 'Do the sensitive thing');
    expect(toolCallId).toBe(TOOL_CALL_ID);

    const before = snapshotModelOutput(await loadAssistantRows(memory, threadId));

    const resumed = await agent.declineToolCall({ runId: stream.runId, toolCallId });
    await drain(resumed);
    // Declining must never execute the tool.
    expect(mockExecute).toHaveBeenCalledTimes(0);

    const after = await loadAssistantRows(memory, threadId);

    // The original row keeps its own reasoning + text and the denied tool call
    // (state `output-denied`, not approved, no result); the model's follow-up
    // reasoning and text move to a fresh row on their own.
    expectCleanResumeBoundary({
      before,
      after,
      preSignature: PRE_APPROVAL_SIGNATURE,
      postSignature: POST_APPROVAL_SIGNATURE,
      postText: 'Understood, cancelled.',
      approval: { approved: false, state: 'output-denied', hasResult: false },
    });
  }, 30000);

  it('a follow-up user turn after approval keeps every reasoning block in its own row (thread stays alive)', async () => {
    const model = scriptedModel([
      turn(
        'id-0',
        [...signedReasoning('reasoning-1', PRE_APPROVAL_SIGNATURE, 'Calling the tool.'), toolCall()],
        'tool-calls',
      ),
      turn(
        'id-1',
        [...signedReasoning('reasoning-2', POST_APPROVAL_SIGNATURE, 'Summarizing.'), ...text('text-2', 'All done.')],
        'stop',
      ),
      turn(
        'id-2',
        [
          ...signedReasoning('reasoning-3', FOLLOW_UP_SIGNATURE, 'Answering the follow-up.'),
          ...text('text-3', 'Sure, here you go.'),
        ],
        'stop',
      ),
    ]);
    const { agent, memory } = buildAgent(model);
    const threadId = 'thread-follow-up';

    const { stream, toolCallId } = await streamUntilApproval(agent, threadId, 'Do the sensitive thing');
    const resumed = await agent.approveToolCall({ runId: stream.runId, toolCallId });
    await drain(resumed);

    // A brand-new user turn on the same thread — this is the turn that used to
    // 400 because it replayed a mutated assistant message.
    const followUp = await agent.stream('And what about tomorrow?', {
      memory: { resource: 'user-1', thread: { id: threadId } },
    });
    let followUpText = '';
    for await (const chunk of followUp.fullStream as AsyncIterable<any>) {
      if (chunk.type === 'text-delta') followUpText += chunk.payload?.text ?? '';
    }
    expect(followUpText).toContain('Sure');

    const assistant = await loadAssistantRows(memory, threadId);

    // Every signed reasoning block from the three model responses is present…
    const allSigs = assistant.flatMap(reasoningSignatures);
    expect(allSigs).toEqual(
      expect.arrayContaining([PRE_APPROVAL_SIGNATURE, POST_APPROVAL_SIGNATURE, FOLLOW_UP_SIGNATURE]),
    );

    // …and no single assistant row ever holds two different response signatures.
    for (const message of assistant) {
      expect(new Set(reasoningSignatures(message)).size).toBeLessThanOrEqual(1);
    }

    // The approved tool call stayed on the row that requested it, and that row
    // never absorbed the later responses' reasoning or text.
    const approvalRow = assistant.find(message => toolInvocation(message, TOOL_CALL_ID));
    expect(approvalRow, 'the approved tool call must stay on its original row').toBeDefined();
    expect(toolInvocation(approvalRow!, TOOL_CALL_ID)!.toolInvocation.state).toBe('result');
    expect(reasoningSignatures(approvalRow!)).toEqual([PRE_APPROVAL_SIGNATURE]);
    expect(assistantText(approvalRow!)).not.toContain('All done.');
    expect(assistantText(approvalRow!)).not.toContain('Sure, here you go.');
  }, 30000);
});
