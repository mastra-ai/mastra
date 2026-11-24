/**
 * Regression for https://github.com/mastra-ai/mastra/issues/21940
 *
 * Calling sendSignal() from a processor's processToolResult hook used to stamp a
 * response boundary on the in-flight assistant message unconditionally
 * (createProcessorSendSignal -> markResponseMessageBoundary) even though the
 * toolResult phase has no rotateResponseMessageId wired. The boundary blocked
 * MessageMerger.shouldMerge, so the next streamed step — carrying the SAME
 * message id because nothing rotated — replaced the message wholesale and
 * destroyed the just-completed tool call/result parts.
 *
 * With thread-scoped Observational Memory the drop surfaced inside the turn:
 * the tool result vanished from the next model step's prompt. The same
 * corruption also broke cross-turn persistence with OM disabled (the text-only
 * replacement got upserted over the tool-bearing row).
 *
 * sendSignal now only seals + rotates where rotation is actually wired
 * (processInputStep / processAPIError) and leaves the in-flight message
 * mergeable everywhere else.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

// =============================================================================
// Capturing actor model: odd calls emit a tool call, even calls emit text.
// Each model call records the exact prompt it received.
// =============================================================================

type CapturedCall = { prompt: unknown[] };

function createCapturingActorModel(captured: CapturedCall[]) {
  let callCount = 0;

  const nextCall = () => {
    callCount += 1;
    return callCount;
  };

  const toolCallStream = (n: number) => ({
    stream: convertArrayToReadableStream([
      { type: 'stream-start' as const, warnings: [] },
      { type: 'response-metadata' as const, id: `mock-resp-${n}`, modelId: 'mock-actor', timestamp: new Date() },
      { type: 'tool-input-start' as const, id: `call-${n}`, toolName: 'delegate' },
      { type: 'tool-input-delta' as const, id: `call-${n}`, delta: JSON.stringify({ task: `task-${n}` }) },
      { type: 'tool-input-end' as const, id: `call-${n}` },
      {
        type: 'finish' as const,
        finishReason: 'tool-calls' as const,
        usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
      },
    ]),
  });

  const textStream = (n: number) => ({
    stream: convertArrayToReadableStream([
      { type: 'stream-start' as const, warnings: [] },
      { type: 'response-metadata' as const, id: `mock-resp-${n}`, modelId: 'mock-actor', timestamp: new Date() },
      { type: 'text-start' as const, id: 'text-1' },
      { type: 'text-delta' as const, id: 'text-1', delta: `Round ${Math.ceil(n / 2)} complete.` },
      { type: 'text-end' as const, id: 'text-1' },
      {
        type: 'finish' as const,
        finishReason: 'stop' as const,
        usage: { inputTokens: 60, outputTokens: 30, totalTokens: 90 },
      },
    ]),
  });

  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      captured.push({ prompt });
      const n = nextCall();
      return n % 2 === 1 ? toolCallStream(n) : textStream(n);
    },
    doGenerate: async ({ prompt }) => {
      captured.push({ prompt });
      const n = nextCall();
      if (n % 2 === 1) {
        return {
          rawCall: { rawPrompt: prompt, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: `call-${n}`,
              toolName: 'delegate',
              input: JSON.stringify({ task: `task-${n}` }),
            },
          ],
          warnings: [],
        };
      }
      const text = `Round ${Math.ceil(n / 2)} complete.`;
      return {
        rawCall: { rawPrompt: prompt, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 60, outputTokens: 30, totalTokens: 90 },
        text,
        content: [{ type: 'text' as const, text }],
        warnings: [],
      };
    },
  });
}

// =============================================================================
// Mock observer/reflector models (OM plumbing — never triggers at default
// thresholds with these tiny messages, matching the production report)
// =============================================================================

function createMockObserverModel() {
  const text = `<observations>
## Observed
- 🔴 User asked supervisor to delegate; sub-agent handled task.
</observations>`;
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        { type: 'response-metadata' as const, id: 'obs-1', modelId: 'mock-observer', timestamp: new Date() },
        { type: 'text-start' as const, id: 'text-1' },
        { type: 'text-delta' as const, id: 'text-1', delta: text },
        { type: 'text-end' as const, id: 'text-1' },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

function createMockReflectorModel() {
  const text = `<observations>
## Condensed
- 🔴 Delegation flow observed.
</observations>`;
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        { type: 'response-metadata' as const, id: 'ref-1', modelId: 'mock-reflector', timestamp: new Date() },
        { type: 'text-start' as const, id: 'text-1' },
        { type: 'text-delta' as const, id: 'text-1', delta: text },
        { type: 'text-end' as const, id: 'text-1' },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

// =============================================================================
// Tool + processor
// =============================================================================

const delegateTool = createTool({
  id: 'delegate',
  description: 'Delegate a task to the sub-agent',
  inputSchema: z.object({ task: z.string() }),
  execute: async ({ task }) => ({
    delegated: task,
    result: `subagent-handled-${task}`,
  }),
});

function createSignalProcessor(phase: 'toolResult' | 'inputStep') {
  const processor: Record<string, unknown> = {
    id: 'guardrail-signal',
    name: 'Guardrail Signal',
  };
  const fire = async (sendSignal?: (input: unknown) => Promise<unknown>) => {
    if (!sendSignal) {
      // Record that the hook ran but sendSignal was unavailable — the test must
      // exercise the signal path, not silently skip it.
      (processor as any).__sendSignalMissing = ((processor as any).__sendSignalMissing ?? 0) + 1;
      return;
    }
    await sendSignal({
      type: 'reactive',
      contents: 'Guardrail reminder: inspect the delegation result before acting again.',
      transient: true,
    });
  };
  if (phase === 'toolResult') {
    processor.processToolResult = async (args: any) => {
      await fire(args?.sendSignal);
    };
  } else {
    processor.processInputStep = async (args: any) => {
      await fire(args?.sendSignal);
    };
  }
  return processor as any;
}

// =============================================================================
// Harness
// =============================================================================

function promptText(prompt: unknown[]): string {
  return JSON.stringify(prompt);
}

function setup(opts: { om: boolean; phase: 'none' | 'toolResult' | 'inputStep' }) {
  const captured: CapturedCall[] = [];
  const memory = new Memory({
    storage: new InMemoryStore(),
    options: opts.om
      ? {
          observationalMemory: {
            enabled: true,
            scope: 'thread',
            observation: { model: createMockObserverModel() as any },
            reflection: { model: createMockReflectorModel() as any },
          },
        }
      : { lastMessages: 100 },
  });
  const processor = opts.phase === 'none' ? undefined : createSignalProcessor(opts.phase);
  const agent = new Agent({
    id: 'supervisor',
    name: 'Supervisor',
    instructions: 'You are a supervisor agent. Always delegate with the delegate tool, then summarize.',
    model: createCapturingActorModel(captured) as any,
    tools: { delegate: delegateTool },
    memory,
    ...(processor ? { outputProcessors: [processor] } : {}),
  });
  return { agent, captured, processor };
}

async function runTurn(agent: Agent, thread: string, question: string) {
  return agent.generate(question, { memory: { thread, resource: 'user-1' } });
}

// =============================================================================
// Tests
// =============================================================================

describe('sendSignal from processToolResult must not drop tool results (issue #21940)', () => {
  it('keeps the tool result in the next step prompt with OM enabled', async () => {
    const { agent, captured, processor } = setup({ om: true, phase: 'toolResult' });
    const result = await runTurn(agent, 'thread-om-tool-result', 'Delegate the research task.');

    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    expect((processor as any).__sendSignalMissing ?? 0).toBe(0);
    expect(captured.length).toBeGreaterThanOrEqual(2);
    // The step-1 prompt must still carry step-0's tool result. Pre-fix, the
    // unrotated response boundary made step 1 replace the message and the
    // result disappeared here.
    expect(promptText(captured[1]!.prompt)).toContain('subagent-handled-task-1');
  });

  it('persists the tool call/result across turns with OM enabled', async () => {
    const { agent, captured, processor } = setup({ om: true, phase: 'toolResult' });
    // Turn 1: model calls 1 (tool) + 2 (text) → task-1
    const t1 = await runTurn(agent, 'thread-om-cross-turn', 'Delegate the research task.');
    expect(t1.steps.length).toBeGreaterThanOrEqual(2);

    // Turn 2: model calls 3 (tool) + 4 (text) → task-3
    const t2 = await runTurn(agent, 'thread-om-cross-turn', 'Delegate the follow-up task.');
    expect(t2.steps.length).toBeGreaterThanOrEqual(2);
    expect((processor as any).__sendSignalMissing ?? 0).toBe(0);
    expect(captured.length).toBeGreaterThanOrEqual(4);

    // Within turn 2: step-1 must contain step-0's tool result.
    expect(promptText(captured[3]!.prompt)).toContain('subagent-handled-task-3');
    // Across turns: turn-2 step-0 must still contain turn-1's tool interaction.
    expect(promptText(captured[2]!.prompt)).toContain('subagent-handled-task-1');
  });

  it('persists the tool call/result across turns with OM disabled', async () => {
    const { agent, captured, processor } = setup({ om: false, phase: 'toolResult' });
    await runTurn(agent, 'thread-om-off-cross-turn', 'Delegate the research task.');
    await runTurn(agent, 'thread-om-off-cross-turn', 'Delegate the follow-up task.');

    expect((processor as any).__sendSignalMissing ?? 0).toBe(0);
    expect(captured.length).toBeGreaterThanOrEqual(4);
    // The corruption is not OM-specific: pre-fix, the text-only replacement was
    // persisted over the tool-bearing row, so turn 2 lost turn 1's tool result.
    expect(promptText(captured[2]!.prompt)).toContain('subagent-handled-task-1');
    expect(promptText(captured[3]!.prompt)).toContain('subagent-handled-task-3');
  });

  it('still delivers processInputStep signals with rotation (control)', async () => {
    const { agent, captured, processor } = setup({ om: true, phase: 'inputStep' });
    const result = await runTurn(agent, 'thread-om-input-step', 'Delegate the research task.');

    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    expect((processor as any).__sendSignalMissing ?? 0).toBe(0);
    expect(captured.length).toBeGreaterThanOrEqual(2);
    // The rotation site must keep working: signal fired (sendSignal present and
    // resolved) and the tool result survives into the next step's prompt. The
    // inputStep call sequence (markBoundary + rotate) is unchanged by the fix;
    // prompt projection of the transient signal under OM is out of scope here —
    // core's sendSignal-integration tests cover inputStep prompt projection.
    expect(promptText(captured[1]!.prompt)).toContain('subagent-handled-task-1');
  });
});
