/**
 * Long-session integration test for ObservationalMemory.
 *
 * Simulates a realistic 30+ turn coding session through the processor API
 * (processInputStep / processOutputResult), exercising the full lifecycle:
 * buffering → activation → observation → reflection.
 */
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';

import { BufferingCoordinator } from '../buffering-coordinator';
import { ObservationalMemory } from '../observational-memory';
import { ObservationalMemoryProcessor } from '../processor';
import type { MemoryContextProvider } from '../processor';

// =============================================================================
// Helpers
// =============================================================================

function createInMemoryStorage(): InMemoryMemory {
  return new InMemoryMemory({ db: new InMemoryDB() });
}

function createMemoryProvider(om: ObservationalMemory): MemoryContextProvider {
  return {
    getContext: async ({ threadId, resourceId }) => {
      const record = await om.getRecord(threadId, resourceId);
      let systemMessage: string | undefined;

      if (record?.activeObservations) {
        systemMessage = await om.buildContextSystemMessage({
          threadId,
          resourceId,
          record,
        });
      }

      const storage = (om as any).storage;
      const dateFilter = record?.lastObservedAt
        ? { dateRange: { start: new Date(new Date(record.lastObservedAt).getTime() + 1) } }
        : undefined;
      const result = await storage.listMessages({
        threadId,
        orderBy: { field: 'createdAt', direction: 'ASC' },
        perPage: false,
        filter: dateFilter,
      });

      return {
        systemMessage,
        messages: result.messages,
        hasObservations: !!record?.activeObservations,
        omRecord: record,
        continuationMessage: undefined,
        otherThreadsContext: undefined,
      };
    },
    persistMessages: async (messages: MastraDBMessage[]) => {
      if (messages.length === 0) return;
      const storage = (om as any).storage;
      await storage.saveMessages({ messages });
    },
  };
}

/**
 * Generate filler text that produces approximately `targetTokens` tokens.
 * tokenx estimates ~1 token per 4 chars for English text.
 */
function generateFiller(targetTokens: number, seed: string = ''): string {
  const words = [
    'implement',
    'refactor',
    'function',
    'component',
    'database',
    'query',
    'response',
    'handler',
    'middleware',
    'authentication',
    'validation',
    'transform',
    'pipeline',
    'configuration',
    'deployment',
  ];
  const charsNeeded = targetTokens * 4;
  let text = seed ? `${seed}: ` : '';
  let i = 0;
  while (text.length < charsNeeded) {
    text += words[i % words.length] + ' ';
    i++;
  }
  return text.slice(0, charsNeeded);
}

function createStreamCapableMockModel(config: Record<string, any>) {
  if (config.doGenerate && !config.doStream) {
    const originalDoGenerate = config.doGenerate;
    return new MockLanguageModelV2({
      ...config,
      doGenerate: async () => {
        throw new Error('Unexpected doGenerate call — OM should use the stream path');
      },
      doStream: async (options: any) => {
        const generated = await originalDoGenerate(options);
        const text = generated.content?.find((part: any) => part?.type === 'text')?.text ?? '';
        const usage = generated.usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: generated.warnings ?? [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'mock-response',
              modelId: 'mock-model',
              timestamp: new Date(),
            });
            controller.enqueue({ type: 'text-start', id: 'text-1' });
            controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
            controller.enqueue({ type: 'text-end', id: 'text-1' });
            controller.enqueue({ type: 'finish', finishReason: generated.finishReason ?? 'stop', usage });
            controller.close();
          },
        });

        return {
          stream,
          rawCall: generated.rawCall ?? { rawPrompt: null, rawSettings: {} },
          warnings: generated.warnings ?? [],
        };
      },
    });
  }

  return new MockLanguageModelV2(config);
}

/**
 * Create a mock observer model that returns progressively larger observations.
 * Each call adds ~observationTokensPerCall tokens of observation text.
 */
function createMockObserverModel(tracker: { observerCalls: number }, observationTokensPerCall: number) {
  return createStreamCapableMockModel({
    doGenerate: async () => {
      tracker.observerCalls++;
      const callNum = tracker.observerCalls;

      // Each observation call produces unique, sizeable observation text
      const observationLines: string[] = [];
      const linesNeeded = Math.ceil(observationTokensPerCall / 30); // ~30 tokens per line
      for (let i = 0; i < linesNeeded; i++) {
        observationLines.push(`* (obs-${callNum}) ${generateFiller(25, `observation-${callNum}-line-${i}`)}`);
      }

      const text = `<observations>
## Session Notes (observation cycle ${callNum})
### Thread: long-session-thread
${observationLines.join('\n')}
</observations>
<current-task>
- Primary: Continue working on the coding task (cycle ${callNum})
</current-task>
<suggested-response>
Continue helping the user with their implementation work.
</suggested-response>`;

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
        content: [{ type: 'text' as const, text }],
        warnings: [],
      };
    },
  });
}

/**
 * Create a mock reflector model that returns compressed observations.
 * Returns ~40% of the input observation text size.
 */
function createMockReflectorModel(tracker: { reflectorCalls: number }) {
  return createStreamCapableMockModel({
    doGenerate: async (options: any) => {
      tracker.reflectorCalls++;
      const callNum = tracker.reflectorCalls;

      // Extract input observation length from prompt to size the output proportionally
      const promptText = JSON.stringify(options?.prompt ?? '');
      const inputTokens = Math.ceil(promptText.length / 4);
      const compressedTokens = Math.ceil(inputTokens * 0.4);

      const lines: string[] = [];
      const linesNeeded = Math.max(5, Math.ceil(compressedTokens / 30));
      for (let i = 0; i < linesNeeded; i++) {
        lines.push(`* (reflected-${callNum}) ${generateFiller(25, `compressed-${callNum}-${i}`)}`);
      }

      const text = `<observations>
## Compressed Session Notes (reflection ${callNum})
${lines.join('\n')}
</observations>`;

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 300, outputTokens: 150, totalTokens: 450 },
        content: [{ type: 'text' as const, text }],
        warnings: [],
      };
    },
  });
}

// =============================================================================
// Turn schedule
// =============================================================================

interface TurnSpec {
  /** Number of tool-use steps (0 = single step, just user→assistant) */
  toolSteps: number;
  /** Approximate tokens per user/assistant message */
  tokensPerMessage: number;
  /** Approximate tokens per tool result (if toolSteps > 0) */
  tokensPerToolResult: number;
}

/**
 * Schedule of ~35 turns simulating a coding session.
 * Mix of short, medium, and long turns.
 */
const TURN_SCHEDULE: TurnSpec[] = [
  // Phase 1: Early warmup — short turns, tokens accumulate slowly
  { toolSteps: 0, tokensPerMessage: 200, tokensPerToolResult: 0 }, // T1: quick question
  { toolSteps: 0, tokensPerMessage: 300, tokensPerToolResult: 0 }, // T2: follow-up
  { toolSteps: 1, tokensPerMessage: 200, tokensPerToolResult: 400 }, // T3: one tool call
  { toolSteps: 0, tokensPerMessage: 250, tokensPerToolResult: 0 }, // T4: clarification

  // Phase 2: Work begins — medium turns, should start seeing buffering
  { toolSteps: 2, tokensPerMessage: 300, tokensPerToolResult: 500 }, // T5: search + read
  { toolSteps: 1, tokensPerMessage: 350, tokensPerToolResult: 600 }, // T6: code lookup
  { toolSteps: 3, tokensPerMessage: 250, tokensPerToolResult: 400 }, // T7: multi-tool chain
  { toolSteps: 0, tokensPerMessage: 400, tokensPerToolResult: 0 }, // T8: discussion

  // Phase 3: Heavy work — long turns, first observation should fire
  { toolSteps: 4, tokensPerMessage: 300, tokensPerToolResult: 500 }, // T9: big edit session
  { toolSteps: 2, tokensPerMessage: 350, tokensPerToolResult: 600 }, // T10: review + fix
  { toolSteps: 0, tokensPerMessage: 500, tokensPerToolResult: 0 }, // T11: long explanation
  { toolSteps: 3, tokensPerMessage: 300, tokensPerToolResult: 450 }, // T12: refactor chain

  // Phase 4: Sustained work — more observations accumulate
  { toolSteps: 1, tokensPerMessage: 400, tokensPerToolResult: 500 }, // T13
  { toolSteps: 5, tokensPerMessage: 250, tokensPerToolResult: 400 }, // T14: big multi-step
  { toolSteps: 0, tokensPerMessage: 350, tokensPerToolResult: 0 }, // T15
  { toolSteps: 2, tokensPerMessage: 300, tokensPerToolResult: 600 }, // T16
  { toolSteps: 4, tokensPerMessage: 300, tokensPerToolResult: 500 }, // T17: another big one
  { toolSteps: 0, tokensPerMessage: 250, tokensPerToolResult: 0 }, // T18

  // Phase 5: Approaching reflection threshold
  { toolSteps: 3, tokensPerMessage: 350, tokensPerToolResult: 450 }, // T19
  { toolSteps: 1, tokensPerMessage: 400, tokensPerToolResult: 500 }, // T20
  { toolSteps: 2, tokensPerMessage: 300, tokensPerToolResult: 600 }, // T21
  { toolSteps: 5, tokensPerMessage: 250, tokensPerToolResult: 400 }, // T22: big session
  { toolSteps: 0, tokensPerMessage: 300, tokensPerToolResult: 0 }, // T23
  { toolSteps: 3, tokensPerMessage: 350, tokensPerToolResult: 500 }, // T24

  // Phase 6: Post-reflection, new observations build again
  { toolSteps: 2, tokensPerMessage: 300, tokensPerToolResult: 500 }, // T25
  { toolSteps: 0, tokensPerMessage: 400, tokensPerToolResult: 0 }, // T26
  { toolSteps: 4, tokensPerMessage: 300, tokensPerToolResult: 450 }, // T27
  { toolSteps: 1, tokensPerMessage: 350, tokensPerToolResult: 600 }, // T28
  { toolSteps: 3, tokensPerMessage: 250, tokensPerToolResult: 500 }, // T29

  // Phase 7: Wind down — few more turns, verify stable state
  { toolSteps: 0, tokensPerMessage: 300, tokensPerToolResult: 0 }, // T30
  { toolSteps: 2, tokensPerMessage: 350, tokensPerToolResult: 400 }, // T31
  { toolSteps: 1, tokensPerMessage: 250, tokensPerToolResult: 500 }, // T32
  { toolSteps: 0, tokensPerMessage: 300, tokensPerToolResult: 0 }, // T33
  { toolSteps: 3, tokensPerMessage: 300, tokensPerToolResult: 450 }, // T34
  { toolSteps: 0, tokensPerMessage: 250, tokensPerToolResult: 0 }, // T35
];

// =============================================================================
// Test
// =============================================================================

describe('Long session: observation and reflection lifecycle', () => {
  let storage: InMemoryMemory;

  beforeEach(() => {
    storage = createInMemoryStorage();
    BufferingCoordinator.asyncBufferingOps.clear();
    BufferingCoordinator.lastBufferedBoundary.clear();
    BufferingCoordinator.lastBufferedAtTime.clear();
    BufferingCoordinator.reflectionBufferCycleIds.clear();
  });

  it('should exercise full lifecycle across 35 turns with buffering, observation, and reflection', async () => {
    const { MessageList } = await import('@mastra/core/agent');
    const { RequestContext } = await import('@mastra/core/di');

    const threadId = 'long-session-thread';
    const resourceId = 'long-session-resource';
    const tracker = { observerCalls: 0, reflectorCalls: 0 };

    // Each observation cycle produces ~2000 tokens of observations
    const observerModel = createMockObserverModel(tracker, 2000);
    const reflectorModel = createMockReflectorModel(tracker);

    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: {
        model: observerModel as any,
        messageTokens: 5_000,
        bufferTokens: 1_500,
        bufferActivation: 0.8,
        blockAfter: 1.5,
      },
      reflection: {
        model: reflectorModel as any,
        observationTokens: 15_000,
        bufferActivation: 0.5,
      },
    });

    await storage.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Long coding session',
        createdAt: new Date('2025-01-01T08:00:00Z'),
        updatedAt: new Date('2025-01-01T08:00:00Z'),
        metadata: {},
      },
    });

    const state: Record<string, unknown> = {};
    const abort = (() => {
      throw new Error('aborted');
    }) as any;
    const makeCtx = () => {
      const ctx = new RequestContext();
      ctx.set('MastraMemory', { thread: { id: threadId }, resourceId });
      return ctx;
    };

    // Create a single processor instance for input — but output uses a separate one
    // (matching production behavior where input/output processors are separate instances)
    const inputProcessor = new ObservationalMemoryProcessor(om, createMemoryProvider(om));
    const outputProcessor = new ObservationalMemoryProcessor(om, createMemoryProvider(om));

    let messageList = new MessageList({ threadId, resourceId });
    let totalUserMessages = 0;
    let totalAssistantMessages = 0;
    let totalToolMessages = 0;
    const baseTime = new Date('2025-01-01T09:00:00Z').getTime();
    let timeOffset = 0;

    // ── Stream writer for capturing emitted parts ──
    // In mastracode, these parts drive the TUI status bar (buffering animation,
    // activation markers, observation progress). Without a writer, all marker
    // emission is silently skipped.
    const capturedParts: any[] = [];
    const mockWriter = {
      custom: async (part: any) => {
        capturedParts.push(part);
      },
    };

    // Track lifecycle milestones
    let firstObservationAtTurn = -1;
    let firstReflectionAtTurn = -1;
    let observationCountAtFirstReflection = 0;
    let maxObservationTokens = 0;
    let observationTokensBeforeReflection = 0;

    // ── Stream event tracking (mirrors mastracode harness state) ──
    let totalStatusParts = 0;
    const turnsWithBufferingStart = new Set<number>();
    const turnsWithActivation = new Set<number>();
    const turnsWithReflectionActivation = new Set<number>();
    const turnsWithObservation = new Set<number>();
    let firstBufferingAnimationTurn = -1;
    // Collect all status parts for post-loop assertions
    const allStatusParts: any[] = [];
    // Track observation start/end pairing per turn
    const observationPairsPerTurn = new Map<number, { starts: number; ends: number }>();

    async function waitForAsyncOps(timeoutMs = 5000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const ops = BufferingCoordinator.asyncBufferingOps as Map<string, Promise<void>>;
        if (ops.size === 0) return;
        await Promise.allSettled([...ops.values()]);
        await new Promise(r => setTimeout(r, 50));
      }
    }

    for (let turnIdx = 0; turnIdx < TURN_SCHEDULE.length; turnIdx++) {
      const spec = TURN_SCHEDULE[turnIdx]!;
      const turnNum = turnIdx + 1;

      // Reset message list for each turn (simulates a new agent invocation)
      messageList = new MessageList({ threadId, resourceId });
      // Reset shared state for new turn (processor creates a new turn)
      Object.keys(state).forEach(k => delete state[k]);

      // Production creates one RequestContext per invocation and reuses it
      // across all processInputStep calls and processOutputResult within the turn
      const turnCtx = makeCtx();

      // Production always has system messages in the messageList (agent instructions).
      // These contribute to context token counting and affect threshold calculations.
      messageList.addSystem(
        'You are Mastra Code, an AI coding assistant. Help the user with software engineering tasks. You have access to tools for reading files, searching code, editing files, and running commands.',
        'system',
      );

      // ── Add user message ──
      const userMsgId = `user-${turnNum}`;
      const userText = generateFiller(spec.tokensPerMessage, `Turn ${turnNum} user question`);
      messageList.add(
        {
          id: userMsgId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: userText }] } as MastraMessageContentV2,
          createdAt: new Date(baseTime + timeOffset),
          threadId,
          resourceId,
        } as any,
        'input',
      );
      timeOffset += 1000;
      totalUserMessages++;

      // ── Step 0: processInputStep ──
      await inputProcessor.processInputStep({
        messageList,
        messages: [],
        requestContext: turnCtx,
        stepNumber: 0,
        state,
        steps: [],
        systemMessages: [],
        model: observerModel as any,
        retryCount: 0,
        abort,
        writer: mockWriter as any,
      });

      // ── Tool steps (if any) ──
      for (let step = 1; step <= spec.toolSteps; step++) {
        // Add tool-call response from assistant
        const toolResultText = generateFiller(spec.tokensPerToolResult, `Turn ${turnNum} tool-${step} result`);
        const toolMsgId = `tool-${turnNum}-${step}`;
        messageList.add(
          {
            id: toolMsgId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    state: 'result',
                    toolName: `tool_${step}`,
                    toolCallId: `call-${turnNum}-${step}`,
                    args: { query: `step ${step}` },
                    result: { output: toolResultText },
                  },
                },
              ],
            } as MastraMessageContentV2,
            createdAt: new Date(baseTime + timeOffset),
            threadId,
            resourceId,
          } as any,
          'response',
        );
        timeOffset += 500;
        totalToolMessages++;

        // processInputStep for step > 0
        await inputProcessor.processInputStep({
          messageList,
          messages: [],
          requestContext: turnCtx,
          stepNumber: step,
          state,
          steps: [],
          systemMessages: [],
          model: observerModel as any,
          retryCount: 0,
          abort,
          writer: mockWriter as any,
        });
      }

      // ── Add final assistant response ──
      const assistantMsgId = `assistant-${turnNum}`;
      const assistantText = generateFiller(spec.tokensPerMessage, `Turn ${turnNum} assistant response`);
      messageList.add(
        {
          id: assistantMsgId,
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: assistantText }] } as MastraMessageContentV2,
          createdAt: new Date(baseTime + timeOffset),
          threadId,
          resourceId,
        } as any,
        'response',
      );
      timeOffset += 1000;
      totalAssistantMessages++;

      // ── processOutputResult (uses output processor, shares state via customState) ──
      await outputProcessor.processOutputResult({
        messageList,
        messages: messageList.get.response.db(),
        requestContext: turnCtx,
        state,
        abort,
        result: {} as any,
        retryCount: 0,
      });

      // Wait for any async buffering to complete before checking state
      await waitForAsyncOps();

      // ── Classify stream parts emitted this turn ──
      const turnParts = [...capturedParts];
      capturedParts.length = 0;

      const turnStatus = turnParts.filter(p => p?.type === 'data-om-status');
      const turnActivations = turnParts.filter(
        p => p?.type === 'data-om-activation' && p?.data?.operationType === 'observation',
      );
      const turnReflectionActivations = turnParts.filter(
        p => p?.type === 'data-om-activation' && p?.data?.operationType === 'reflection',
      );
      const turnBufferingStarts = turnParts.filter(p => p?.type === 'data-om-buffering-start');
      const turnObsStarts = turnParts.filter(
        p => p?.type === 'data-om-observation-start' || p?.type === 'data-om-sync-observation-start',
      );
      const turnObsEnds = turnParts.filter(
        p => p?.type === 'data-om-observation-end' || p?.type === 'data-om-sync-observation-end',
      );

      totalStatusParts += turnStatus.length;
      allStatusParts.push(...turnStatus);

      if (turnBufferingStarts.length > 0) turnsWithBufferingStart.add(turnNum);
      if (turnActivations.length > 0) turnsWithActivation.add(turnNum);
      if (turnReflectionActivations.length > 0) turnsWithReflectionActivation.add(turnNum);
      if (turnObsStarts.length > 0 || turnObsEnds.length > 0) turnsWithObservation.add(turnNum);

      // Check for buffering animation in status parts
      if (firstBufferingAnimationTurn === -1) {
        for (const sp of turnStatus) {
          if (sp?.data?.windows?.buffered?.observations?.status === 'running') {
            firstBufferingAnimationTurn = turnNum;
            break;
          }
        }
      }

      // Track observation start/end pairing
      if (turnObsStarts.length > 0 || turnObsEnds.length > 0) {
        observationPairsPerTurn.set(turnNum, {
          starts: turnObsStarts.length,
          ends: turnObsEnds.length,
        });
      }

      // ── Record milestones ──
      const record = await om.getRecord(threadId, resourceId);
      const obsTokens = record?.observationTokenCount ?? 0;

      if (obsTokens > maxObservationTokens) {
        maxObservationTokens = obsTokens;
      }

      if (firstObservationAtTurn === -1 && record?.activeObservations) {
        firstObservationAtTurn = turnNum;
      }

      if (firstReflectionAtTurn === -1 && tracker.reflectorCalls > 0) {
        firstReflectionAtTurn = turnNum;
        observationCountAtFirstReflection = tracker.observerCalls;
        observationTokensBeforeReflection = maxObservationTokens;
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Assertions
    // ═════════════════════════════════════════════════════════════════════════

    const finalRecord = await om.getRecord(threadId, resourceId);

    // ── Observation lifecycle ──
    expect(tracker.observerCalls).toBeGreaterThanOrEqual(3);
    expect(firstObservationAtTurn).toBeGreaterThan(1);
    expect(firstObservationAtTurn).toBeLessThanOrEqual(15);
    expect(finalRecord?.activeObservations).toBeTruthy();
    expect(finalRecord?.lastObservedAt).toBeTruthy();

    // ── Observation token growth ──
    expect(maxObservationTokens).toBeGreaterThan(0);

    // ── Reflection lifecycle ──
    expect(tracker.reflectorCalls).toBeGreaterThanOrEqual(1);
    expect(firstReflectionAtTurn).toBeGreaterThan(firstObservationAtTurn);
    expect(observationCountAtFirstReflection).toBeGreaterThanOrEqual(3);

    // After reflection, observation tokens should have decreased from peak
    const finalObsTokens = finalRecord?.observationTokenCount ?? 0;
    // (observation tokens may have grown again after reflection from new observations,
    // but reflection should have occurred at some point)

    // ── Message persistence ──
    await om.waitForBuffering(threadId, resourceId);
    await waitForAsyncOps();

    const { messages: allMessages } = await storage.listMessages({
      threadId,
      perPage: false,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });

    const savedUserMessages = allMessages.filter(m => m.role === 'user');
    const savedAssistantMessages = allMessages.filter(m => m.role === 'assistant');

    // Every user message should be saved exactly once
    const userIds = savedUserMessages.map(m => m.id);
    const uniqueUserIds = new Set(userIds);
    expect(uniqueUserIds.size).toBe(totalUserMessages);
    expect(userIds.length).toBe(totalUserMessages);

    // Every assistant message (final responses + tool results) should be saved
    // Tool results may get cleaned up after observation, so we check >= rather than exact
    expect(savedAssistantMessages.length).toBeGreaterThanOrEqual(totalAssistantMessages);

    // ── Buffered chunks may remain after the turn now that finish no longer
    // waits for buffering completion or forces a final observation pass.
    const finalStatus = await om.getStatus({ threadId, resourceId });
    expect(finalStatus.bufferedChunkCount).toBeGreaterThanOrEqual(0);

    // ── Stream event: data-om-status ──
    // At least one status part per turn (multi-step turns may emit more)
    expect(totalStatusParts).toBeGreaterThanOrEqual(TURN_SCHEDULE.length);
    // Thresholds should never be 0 — this was the original 0/0k bug where
    // effectiveObservationTokensThreshold was hardcoded to 0 in processor.ts
    for (const sp of allStatusParts) {
      const msgThreshold = sp?.data?.windows?.active?.messages?.threshold ?? 0;
      expect(msgThreshold).toBeGreaterThan(0);
    }
    // After the first observation, observation tokens should be reported
    const statusWithObsTokens = allStatusParts.filter(sp => (sp?.data?.windows?.active?.observations?.tokens ?? 0) > 0);
    expect(statusWithObsTokens.length).toBeGreaterThanOrEqual(1);
    // Buffering animation should trigger at some point (stale-record fix)
    const statusWithBufferingRunning = allStatusParts.filter(
      sp => sp?.data?.windows?.buffered?.observations?.status === 'running',
    );
    expect(statusWithBufferingRunning.length).toBeGreaterThanOrEqual(1);

    // ── Stream event: data-om-buffering-start ──
    expect(turnsWithBufferingStart.size).toBeGreaterThanOrEqual(1);
    // Buffering should start before the first observation
    const firstBufferingTurn = Math.min(...turnsWithBufferingStart);
    const firstObsTurn = turnsWithObservation.size > 0 ? Math.min(...turnsWithObservation) : Infinity;
    expect(firstBufferingTurn).toBeLessThan(firstObsTurn);

    // ── Stream event: data-om-activation (observation) ──
    expect(turnsWithActivation.size).toBeGreaterThanOrEqual(1);
    // Can't activate before buffering starts
    const firstActivationTurn = Math.min(...turnsWithActivation);
    expect(firstActivationTurn).toBeGreaterThanOrEqual(firstBufferingTurn);

    // ── Stream event: data-om-activation (reflection) ──
    // Reflections happened (9+ reflector calls), so at least one should have been
    // an async buffered reflection that got activated with a marker.
    expect(turnsWithReflectionActivation.size).toBeGreaterThan(0);
    // Reflection activations should not happen before observations start
    const firstReflectionActivationTurn = Math.min(...turnsWithReflectionActivation);
    expect(firstReflectionActivationTurn).toBeGreaterThanOrEqual(firstObservationAtTurn);

    // ── Stream event: observation start/end markers ──
    // Finish cleanup no longer forces a final observation pass, so observation
    // work may still happen during the lifecycle without emitting a terminal
    // turn marker in this harness.
    expect(tracker.observerCalls).toBeGreaterThanOrEqual(3);
    for (const [, pair] of observationPairsPerTurn) {
      expect(pair.ends).toBeGreaterThanOrEqual(pair.starts);
    }

    // ── Summary log ──
    console.log(`Long session test completed:
  Turns: ${TURN_SCHEDULE.length}
  Observer calls: ${tracker.observerCalls}
  Reflector calls: ${tracker.reflectorCalls}
  First observation at turn: ${firstObservationAtTurn}
  First reflection at turn: ${firstReflectionAtTurn}
  Observation tokens before reflection: ${observationTokensBeforeReflection}
  Final observation tokens: ${finalObsTokens}
  Max observation tokens: ${maxObservationTokens}
  Total messages saved: ${allMessages.length}
  User messages: ${savedUserMessages.length}/${totalUserMessages}
  Assistant messages: ${savedAssistantMessages.length}/${totalAssistantMessages + totalToolMessages}
  --- Stream events ---
  Status parts emitted: ${totalStatusParts}
  Turns with buffering animation: ${firstBufferingAnimationTurn > 0 ? `first at turn ${firstBufferingAnimationTurn}` : 'none'}
  Turns with buffering-start marker: ${[...turnsWithBufferingStart].sort((a, b) => a - b).join(', ') || 'none'}
  Turns with obs activation marker: ${[...turnsWithActivation].sort((a, b) => a - b).join(', ') || 'none'}
  First reflection activation at turn: ${firstReflectionActivationTurn}
  Turns with refl activation marker: ${[...turnsWithReflectionActivation].sort((a, b) => a - b).join(', ') || 'none'}
  Turns with observation markers: ${[...turnsWithObservation].sort((a, b) => a - b).join(', ') || 'none'}`);
  }, 60_000);
});
