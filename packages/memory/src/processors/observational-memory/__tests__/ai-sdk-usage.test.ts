/**
 * AI SDK Integration Tests
 *
 * Validates that the patterns documented in explorations/ai-sdk-usage.ts and
 * explorations/ai-sdk-buffering.ts actually work end-to-end: real generateText
 * calls with mock models, OM primitives wired into onStepFinish/prepareStep hooks.
 */

import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { generateText, stepCountIs, tool } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';

import { BufferingCoordinator } from '../buffering-coordinator';
import { ObservationalMemory } from '../observational-memory';

// =============================================================================
// Helpers
// =============================================================================

function createInMemoryStorage(): InMemoryMemory {
  return new InMemoryMemory({ db: new InMemoryDB() });
}

function createMockObserverModel() {
  const observationText = `<observations>
* User discussed various topics in the conversation
* Assistant provided helpful responses
</observations>
<current-task>
- Primary: Continue conversation
</current-task>
<suggested-response>
Continue helping the user
</suggested-response>`;

  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      warnings: [],
      content: [{ type: 'text', text: observationText }],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'obs-1', modelId: 'mock-observer', timestamp: new Date() },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: observationText },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  } as any);
}

function createMockActorModel(response: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
      warnings: [],
      content: [{ type: 'text', text: response }],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'a-1', modelId: 'mock-actor', timestamp: new Date() },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: response },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/**
 * Creates a mock model that makes a tool call on the first invocation,
 * then returns text on the second. This drives a 2-step generateText loop.
 * Uses doStream since that's what AI SDK v5 generateText calls internally.
 */
function createMultiStepActorModel(finalResponse: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      callCount++;
      if (callCount === 1) {
        // Step 1: tool call → triggers another step
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 30, outputTokens: 10, totalTokens: 40 },
          warnings: [],
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'call-1',
              toolName: 'lookup',
              input: { query: 'test' },
            },
          ],
        };
      }
      // Step 2: text response → done
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
        warnings: [],
        content: [{ type: 'text' as const, text: finalResponse }],
      };
    },
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 's1', modelId: 'mock', timestamp: new Date() },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: finalResponse },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

function createTestMessage(
  content: string,
  role: 'user' | 'assistant' = 'user',
  id?: string,
  createdAt?: Date,
): MastraDBMessage {
  return {
    id: id ?? `msg-${Math.random().toString(36).slice(2)}`,
    role,
    content: { format: 2, parts: [{ type: 'text', text: content }] } as MastraMessageContentV2,
    type: 'text',
    createdAt: createdAt ?? new Date(),
  };
}

function toAiSdkMessage(msg: MastraDBMessage) {
  let text = '';
  if (msg.content && typeof msg.content === 'object' && 'parts' in msg.content) {
    text = (msg.content as MastraMessageContentV2).parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('');
  }
  return { role: msg.role as 'user' | 'assistant', content: text };
}

function createMessagesExceedingThreshold(count: number, threadId: string): MastraDBMessage[] {
  return Array.from({ length: count }, (_, i) =>
    createTestMessage(
      `Message ${i}: `.padEnd(200, 'x'),
      i % 2 === 0 ? 'user' : 'assistant',
      `${threadId}-msg-${i}`,
      new Date(Date.now() - (count - i) * 1000),
    ),
  ).map(m => ({ ...m, threadId }));
}

function createOM(storage: InMemoryMemory, opts?: { messageTokens?: number; bufferTokens?: number | false }) {
  return new ObservationalMemory({
    storage,
    scope: 'thread',
    observation: {
      model: createMockObserverModel(),
      messageTokens: opts?.messageTokens ?? 100,
      bufferTokens: opts?.bufferTokens ?? false,
    },
    reflection: {
      model: createMockObserverModel(),
      observationTokens: 50_000,
    },
  });
}

// Reset BufferingCoordinator static maps between tests to prevent cross-test leakage
beforeEach(() => {
  BufferingCoordinator.asyncBufferingOps.clear();
  BufferingCoordinator.lastBufferedBoundary.clear();
  BufferingCoordinator.lastBufferedAtTime.clear();
  BufferingCoordinator.reflectionBufferCycleIds.clear();
});

// =============================================================================
// CASE 1 — Simple single-turn (ai-sdk-usage.ts: chat())
//
//   getContext → generateText → saveMessages → observe
// =============================================================================

describe('AI SDK: single-turn chat() pattern', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'chat-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage);
  });

  it('getContext → generateText → saveMessages → observe', async () => {
    // Seed history
    await storage.saveMessages({ messages: createMessagesExceedingThreshold(8, threadId) });

    // 1. Build context (mirrors memory.getContext())
    const record = await om.getRecord(threadId);
    const systemMessage = record?.activeObservations
      ? await om.buildContextSystemMessage({ threadId, record })
      : undefined;
    const loaded = await storage.listMessages({
      threadId,
      orderBy: { field: 'createdAt', direction: 'ASC' },
      perPage: false,
    });

    // 2. generateText
    const result = await generateText({
      model: createMockActorModel('I can help!'),
      system: systemMessage,
      messages: [...loaded.messages.map(toAiSdkMessage), { role: 'user' as const, content: 'Help me' }],
    });
    expect(result.text).toBe('I can help!');

    // 3. Save
    await storage.saveMessages({
      messages: [
        { ...createTestMessage('Help me', 'user', `${threadId}-u`), threadId },
        { ...createTestMessage(result.text, 'assistant', `${threadId}-a`), threadId },
      ],
    });

    // 4. Observe
    const obsResult = await om.observe({ threadId });
    expect(obsResult.observed).toBe(true);
    expect(obsResult.record.activeObservations).toContain('User discussed');
  });

  it('subsequent turn uses observations as system message in generateText', async () => {
    // Turn 1
    await storage.saveMessages({ messages: createMessagesExceedingThreshold(10, threadId) });
    await om.observe({ threadId });

    // Turn 2: observations feed into generateText
    const record = (await om.getRecord(threadId))!;
    const systemMessage = await om.buildContextSystemMessage({ threadId, record });
    expect(systemMessage).toContain('User discussed');

    const result = await generateText({
      model: createMockActorModel('I remember our chat'),
      system: systemMessage,
      messages: [{ role: 'user' as const, content: 'What did we talk about?' }],
    });
    expect(result.text).toBe('I remember our chat');
  });
});

// =============================================================================
// CASE 2 — Multi-step with buffering hooks (ai-sdk-buffering.ts: multiStepWithBuffering())
//
//   generateText({ stopWhen, tools, onStepFinish, prepareStep })
//   onStepFinish: save messages → getStatus → buffer or observe
//   prepareStep:  rebuild context from observations
// =============================================================================

describe('AI SDK: multi-step generateText with buffering hooks', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'multistep-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage);
  });

  it('onStepFinish calls getStatus/observe, prepareStep rebuilds context', async () => {
    // Seed enough history to trigger observation
    await storage.saveMessages({ messages: createMessagesExceedingThreshold(10, threadId) });

    const hookLog: string[] = [];
    let prepareStepCalledWithSystem: string | undefined;

    const lookupTool = tool({
      description: 'Look something up',
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => `Result for: ${query}`,
    });

    const result = await generateText({
      model: createMultiStepActorModel('Final answer after tool use'),
      stopWhen: stepCountIs(3),
      tools: { lookup: lookupTool },
      messages: [{ role: 'user' as const, content: 'Look up something for me' }],

      async onStepFinish() {
        hookLog.push('onStepFinish');

        // Save step messages to storage (in a real app, these come from response)
        const stepMsg = createTestMessage('step output', 'assistant', `${threadId}-step-${hookLog.length}`);
        await storage.saveMessages({ messages: [{ ...stepMsg, threadId }] });

        // Check status and act — the core pattern from the exploration
        const status = await om.getStatus({ threadId });

        if (status.shouldObserve) {
          if (status.canActivate) {
            await om.activate({ threadId });
          }
          await om.observe({ threadId });
          hookLog.push('observed');
        } else if (status.shouldBuffer) {
          await om.buffer({ threadId });
          hookLog.push('buffered');
        }
      },

      async prepareStep({ stepNumber }: any) {
        if (stepNumber === 0) return undefined;

        hookLog.push(`prepareStep(${stepNumber})`);

        // Rebuild context with latest observations — the core pattern
        const record = await om.getRecord(threadId);
        const freshSystem = record?.activeObservations
          ? await om.buildContextSystemMessage({ threadId, record })
          : undefined;

        prepareStepCalledWithSystem = freshSystem;

        // Return updated system + messages for the next step
        return {
          system: freshSystem,
        };
      },
    });

    // generateText completed with the final text response from step 2
    expect(result.text).toBe('Final answer after tool use');

    // onStepFinish was called (at least once per step)
    expect(hookLog.filter(h => h === 'onStepFinish').length).toBeGreaterThanOrEqual(1);

    // Observation should have been triggered inside onStepFinish
    expect(hookLog).toContain('observed');

    // prepareStep was called for step > 0 and got the observation system message
    expect(hookLog).toContain('prepareStep(1)');
    expect(prepareStepCalledWithSystem).toContain('observations');

    // Observations persisted
    const record = await om.getRecord(threadId);
    expect(record!.activeObservations).toBeTruthy();
  });

  it('onStepFinish buffers when below threshold, observes when above', async () => {
    // Use a higher threshold so first step buffers, second step observes
    om = createOM(storage, { messageTokens: 300, bufferTokens: 0.2 });

    // Seed messages below the 300-token threshold but above buffer interval
    await storage.saveMessages({ messages: createMessagesExceedingThreshold(4, threadId) });

    const hookActions: string[] = [];

    const lookupTool = tool({
      description: 'Look something up',
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => `Result for: ${query}`,
    });

    await generateText({
      model: createMultiStepActorModel('Done'),
      stopWhen: stepCountIs(3),
      tools: { lookup: lookupTool },
      messages: [{ role: 'user' as const, content: 'Do a multi-step task' }],

      async onStepFinish() {
        // Add more messages each step to simulate growing context
        const newMsgs = createMessagesExceedingThreshold(5, threadId).map((m, i) => ({
          ...m,
          id: `${threadId}-grow-${hookActions.length}-${i}`,
          createdAt: new Date(Date.now() + hookActions.length * 10000 + i * 1000),
        }));
        await storage.saveMessages({ messages: newMsgs });

        const status = await om.getStatus({ threadId });
        if (status.shouldObserve) {
          if (status.canActivate) await om.activate({ threadId });
          await om.observe({ threadId });
          hookActions.push('observe');
        } else if (status.shouldBuffer) {
          await om.buffer({ threadId });
          hookActions.push('buffer');
        } else {
          hookActions.push('noop');
        }
      },
    });

    // At least one hook action should have fired
    expect(hookActions.length).toBeGreaterThanOrEqual(1);
    // The pattern should include either buffering or observation
    expect(hookActions.some(a => a === 'buffer' || a === 'observe')).toBe(true);
  });
});

// =============================================================================
// CASE 3 — Buffering + activation across turns (ai-sdk-usage.ts: chatWithBuffering())
//
//   Turn N:   buffer during onStepFinish
//   Turn N+1: activate → generateText with fresh context → observe
// =============================================================================

describe('AI SDK: buffer in one turn, activate + generateText in next', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'cross-turn-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
  });

  it('activate before generateText picks up buffered observations', async () => {
    // Turn 1: seed messages and buffer
    await storage.saveMessages({ messages: createMessagesExceedingThreshold(5, threadId) });
    const bufResult = await om.buffer({ threadId });

    if (bufResult.buffered) {
      // Turn 2: activate, then use in generateText
      const status = await om.getStatus({ threadId });
      expect(status.canActivate).toBe(true);

      const actResult = await om.activate({ threadId });
      expect(actResult.activated).toBe(true);
      expect(actResult.record.activeObservations).toBeTruthy();

      // Use the activated observations in generateText
      const record = (await om.getRecord(threadId))!;
      const systemMessage = await om.buildContextSystemMessage({ threadId, record });
      expect(systemMessage).toContain('observations');

      const result = await generateText({
        model: createMockActorModel('Continuing with buffered context'),
        system: systemMessage,
        messages: [{ role: 'user' as const, content: 'Continue' }],
      });
      expect(result.text).toBe('Continuing with buffered context');
    }
  });

  it('writes observer-exchange repro captures for buffering', async () => {
    const reproDir = mkdtempSync('.tmp-om-repro-');
    const previousCapture = process.env.OM_REPRO_CAPTURE;
    const previousCaptureDir = process.env.OM_REPRO_CAPTURE_DIR;
    process.env.OM_REPRO_CAPTURE = '1';
    process.env.OM_REPRO_CAPTURE_DIR = reproDir;

    try {
      await storage.saveMessages({ messages: createMessagesExceedingThreshold(5, threadId) });
      const bufResult = await om.buffer({ threadId });

      expect(bufResult.buffered).toBe(true);

      const threadCaptureDir = join(process.cwd(), reproDir, threadId);
      const runDir = readdirSync(threadCaptureDir).find(name => name.includes('buffer-buffer-obs-'));
      expect(runDir).toBeTruthy();

      const observerExchange = JSON.parse(
        readFileSync(join(threadCaptureDir, runDir!, 'observer-exchange.json'), 'utf8'),
      );
      expect(observerExchange.systemPrompt).toBeTruthy();
      expect(observerExchange.observerMessages).toHaveLength(2);
      expect(observerExchange.rawOutput).toContain('<observations>');
    } finally {
      if (previousCapture === undefined) {
        delete process.env.OM_REPRO_CAPTURE;
      } else {
        process.env.OM_REPRO_CAPTURE = previousCapture;
      }

      if (previousCaptureDir === undefined) {
        delete process.env.OM_REPRO_CAPTURE_DIR;
      } else {
        process.env.OM_REPRO_CAPTURE_DIR = previousCaptureDir;
      }

      rmSync(reproDir, { recursive: true, force: true });
    }
  });
});

// =============================================================================
// CASE 4 — Multi-turn round-trip
//
//   Turn 1: generateText → save → observe
//   Turn 2: getContext (with observations) → generateText
// =============================================================================

describe('AI SDK: multi-turn round-trip', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'roundtrip-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage);
  });

  it('observations from turn 1 feed into generateText system message in turn 2', async () => {
    // Turn 1: generate + observe
    await storage.saveMessages({ messages: createMessagesExceedingThreshold(10, threadId) });

    const turn1 = await generateText({
      model: createMockActorModel('Turn 1'),
      messages: [{ role: 'user' as const, content: 'Hello' }],
    });
    expect(turn1.text).toBe('Turn 1');

    await storage.saveMessages({
      messages: [
        { ...createTestMessage('Hello', 'user', `${threadId}-t1u`), threadId },
        { ...createTestMessage(turn1.text, 'assistant', `${threadId}-t1a`), threadId },
      ],
    });

    const obsResult = await om.observe({ threadId });
    expect(obsResult.observed).toBe(true);

    // Turn 2: observations in system message
    const record = (await om.getRecord(threadId))!;
    const systemMessage = await om.buildContextSystemMessage({ threadId, record });
    expect(systemMessage).toContain('User discussed');

    const turn2 = await generateText({
      model: createMockActorModel('Turn 2 with memory'),
      system: systemMessage,
      messages: [{ role: 'user' as const, content: 'What did we discuss?' }],
    });
    expect(turn2.text).toBe('Turn 2 with memory');
  });
});

// =============================================================================
// CASE 5 — Multiple threads each get their own generateText call
// =============================================================================

describe('AI SDK: per-thread generateText with observations', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage);
  });

  it('each thread observes independently and feeds observations into generateText', async () => {
    const threadIds = ['t-1', 't-2', 't-3'];

    for (const tid of threadIds) {
      // Seed + observe
      await storage.saveMessages({ messages: createMessagesExceedingThreshold(10, tid) });
      const obs = await om.observe({ threadId: tid });
      expect(obs.observed).toBe(true);

      // generateText with that thread's observations
      const record = (await om.getRecord(tid))!;
      const sys = await om.buildContextSystemMessage({ threadId: tid, record });
      expect(sys).toContain('observations');

      const result = await generateText({
        model: createMockActorModel(`Response for ${tid}`),
        system: sys,
        messages: [{ role: 'user' as const, content: 'Summarize' }],
      });
      expect(result.text).toBe(`Response for ${tid}`);
    }
  });
});

// =============================================================================
// CASE 6 — Multi-turn buffer→activate lifecycle invariants
//
//   Validates the core invariants of the staged observation path:
//   - buffer() extracts to staging, does NOT update lastObservedAt
//   - activate() promotes staging to active, no LLM call
//   - shouldBuffer and shouldObserve are mutually exclusive
//   - pendingTokens keep growing across buffer+activate cycles
//   - final observe() advances the cursor and resets pending count
//   - matches the pattern in explorations/ai-sdk-buffering.ts
// =============================================================================

describe('AI SDK: multi-turn buffer→activate lifecycle invariants', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'lifecycle-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    // bufferTokens: 0.2 enables async observation with buffer interval at 20% of threshold
    om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
  });

  it('buffer does not update lastObservedAt', async () => {
    await storage.saveMessages({ messages: createMessagesExceedingThreshold(5, threadId) });

    const recordBefore = await om.getOrCreateRecord(threadId);
    const lastObservedBefore = recordBefore.lastObservedAt;

    await om.buffer({ threadId });

    const recordAfter = await om.getRecord(threadId);
    expect(recordAfter!.lastObservedAt).toEqual(lastObservedBefore);
  });

  it('activate promotes buffered observations without LLM call', async () => {
    await storage.saveMessages({ messages: createMessagesExceedingThreshold(5, threadId) });

    // Buffer first
    const bufResult = await om.buffer({ threadId });
    expect(bufResult.buffered).toBe(true);

    const statusAfterBuffer = await om.getStatus({ threadId });
    expect(statusAfterBuffer.canActivate).toBe(true);
    expect(statusAfterBuffer.bufferedChunkCount).toBeGreaterThan(0);

    // Activate — this is a pure storage swap, no model call
    const actResult = await om.activate({ threadId });
    expect(actResult.activated).toBe(true);
    expect(actResult.record.activeObservations).toBeTruthy();

    // After activation, no more buffered chunks
    const statusAfterActivate = await om.getStatus({ threadId });
    expect(statusAfterActivate.canActivate).toBe(false);
    expect(statusAfterActivate.bufferedChunkCount).toBe(0);
  });

  it('shouldBuffer and shouldObserve are mutually exclusive', async () => {
    // Seed below threshold — should buffer but not observe
    await storage.saveMessages({ messages: createMessagesExceedingThreshold(3, threadId) });

    const statusLow = await om.getStatus({ threadId });
    if (statusLow.shouldBuffer) {
      expect(statusLow.shouldObserve).toBe(false);
    }

    // Add enough to cross threshold — should observe but not buffer
    await storage.saveMessages({
      messages: createMessagesExceedingThreshold(20, threadId).map((m, i) => ({
        ...m,
        id: `${threadId}-extra-${i}`,
        createdAt: new Date(Date.now() + (i + 1) * 1000),
      })),
    });

    const statusHigh = await om.getStatus({ threadId });
    if (statusHigh.shouldObserve) {
      expect(statusHigh.shouldBuffer).toBe(false);
    }
  });

  it('pendingTokens keep growing across buffer+activate cycles since lastObservedAt is unchanged', async () => {
    // Turn 1: add messages and buffer
    const turn1Msgs = createMessagesExceedingThreshold(5, threadId);
    await storage.saveMessages({ messages: turn1Msgs });
    await om.buffer({ threadId });

    const statusAfterTurn1 = await om.getStatus({ threadId });
    const pendingAfterTurn1 = statusAfterTurn1.pendingTokens;
    expect(pendingAfterTurn1).toBeGreaterThan(0);

    // Turn 2: activate, add MORE messages (different IDs), buffer again
    await om.activate({ threadId });

    // Use a larger batch with unique IDs so total unobserved messages grows
    const turn2Msgs = createMessagesExceedingThreshold(8, threadId).map((m, i) => ({
      ...m,
      id: `${threadId}-turn2-${i}`,
      createdAt: new Date(Date.now() + (i + 1) * 10000),
    }));
    await storage.saveMessages({ messages: turn2Msgs });
    await om.buffer({ threadId });

    const statusAfterTurn2 = await om.getStatus({ threadId });
    // Pending tokens should have grown because lastObservedAt hasn't moved
    // and we added more messages on top of the existing ones
    expect(statusAfterTurn2.pendingTokens).toBeGreaterThan(pendingAfterTurn1);
  });

  it('observe advances cursor and resets pending count', async () => {
    // Use a low-threshold OM so observe() actually triggers
    const lowThresholdOm = createOM(storage, { messageTokens: 50, bufferTokens: 0.2 });

    // Build up messages across two buffer+activate cycles
    await storage.saveMessages({ messages: createMessagesExceedingThreshold(5, threadId) });
    await lowThresholdOm.buffer({ threadId });
    await lowThresholdOm.activate({ threadId });

    await storage.saveMessages({
      messages: createMessagesExceedingThreshold(5, threadId).map((m, i) => ({
        ...m,
        id: `${threadId}-more-${i}`,
        createdAt: new Date(Date.now() + (i + 1) * 10000),
      })),
    });

    const statusBefore = await lowThresholdOm.getStatus({ threadId });
    expect(statusBefore.pendingTokens).toBeGreaterThan(0);

    // Observe — this should advance lastObservedAt and drop pending count
    const obsResult = await lowThresholdOm.observe({ threadId });
    expect(obsResult.observed).toBe(true);

    const recordAfter = await lowThresholdOm.getRecord(threadId);
    const statusAfter = await lowThresholdOm.getStatus({ threadId });

    // After a successful observe, lastObservedAt should be set
    expect(recordAfter!.lastObservedAt).toBeTruthy();

    // Pending tokens should be 0 (no new messages since observe)
    expect(statusAfter.pendingTokens).toBe(0);
    expect(statusAfter.shouldObserve).toBe(false);
  });

  it('full multi-turn cycle: buffer → activate+buffer → activate → observe', async () => {
    // messageTokens: 500 — buffer interval is 100 tokens (0.2 * 500).
    // Small batches (~200 tokens) trigger buffer but not observe.
    // Large final batch pushes past 500 to trigger observe.
    const cycleOm = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
    // Use a unique threadId to avoid static state leaking from prior tests
    const cycleThreadId = 'lifecycle-cycle-thread';

    // ── Turn 1: seed + buffer ──
    await storage.saveMessages({ messages: createMessagesExceedingThreshold(5, cycleThreadId) });

    const buf1 = await cycleOm.buffer({ threadId: cycleThreadId });
    expect(buf1.buffered).toBe(true);

    const afterTurn1 = await cycleOm.getStatus({ threadId: cycleThreadId });
    expect(afterTurn1.canActivate).toBe(true);

    // ── Turn 2: activate + add messages + buffer ──
    const act1 = await cycleOm.activate({ threadId: cycleThreadId });
    expect(act1.activated).toBe(true);
    expect(act1.record.activeObservations).toBeTruthy();

    await storage.saveMessages({
      messages: createMessagesExceedingThreshold(5, cycleThreadId).map((m, i) => ({
        ...m,
        id: `${cycleThreadId}-t2-${i}`,
        createdAt: new Date(Date.now() + (i + 1) * 10000),
      })),
    });

    const buf2 = await cycleOm.buffer({ threadId: cycleThreadId });
    expect(buf2.buffered).toBe(true);

    // ── Turn 3: activate (merges turn 2 buffer into active) ──
    const act2 = await cycleOm.activate({ threadId: cycleThreadId });
    expect(act2.activated).toBe(true);
    expect(act2.record.activeObservations).toBeTruthy();

    // ── Add a large batch to push past the observe threshold ──
    await storage.saveMessages({
      messages: createMessagesExceedingThreshold(20, cycleThreadId).map((m, i) => ({
        ...m,
        id: `${cycleThreadId}-t3-${i}`,
        createdAt: new Date(Date.now() + (i + 1) * 20000),
      })),
    });

    // ── Final: observe to consolidate and advance cursor ──
    const statusPreObserve = await cycleOm.getStatus({ threadId: cycleThreadId });
    expect(statusPreObserve.pendingTokens).toBeGreaterThan(0);

    const obsResult = await cycleOm.observe({ threadId: cycleThreadId });
    expect(obsResult.observed).toBe(true);
    expect(obsResult.record.activeObservations).toBeTruthy();
    expect(obsResult.record.lastObservedAt).toBeTruthy();

    // After observe, pending should be reset
    const statusPostObserve = await cycleOm.getStatus({ threadId: cycleThreadId });
    expect(statusPostObserve.pendingTokens).toBe(0);
    expect(statusPostObserve.shouldObserve).toBe(false);
  });
});

// =============================================================================
// CASE 7 — getStatus with in-memory messages
//
//   Validates that getStatus({ messages }) produces the same results as
//   the storage-backed getStatus() when messages match storage contents.
// =============================================================================

describe('AI SDK: getStatus with in-memory messages', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;
  const threadId = 'inmemory-status-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
    om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });
  });

  it('getStatus with messages matches storage-backed getStatus', async () => {
    const messages = createMessagesExceedingThreshold(5, threadId);
    await storage.saveMessages({ messages });

    // Storage-backed
    const storageStatus = await om.getStatus({ threadId });

    // In-memory
    const inMemoryStatus = await om.getStatus({ threadId, messages });

    expect(inMemoryStatus.pendingTokens).toBe(storageStatus.pendingTokens);
    expect(inMemoryStatus.threshold).toBe(storageStatus.threshold);
    expect(inMemoryStatus.shouldObserve).toBe(storageStatus.shouldObserve);
    expect(inMemoryStatus.shouldBuffer).toBe(storageStatus.shouldBuffer);
    expect(inMemoryStatus.canActivate).toBe(storageStatus.canActivate);
  });

  it('getStatus with messages sees unpersisted messages', async () => {
    // Don't save to storage — only pass in-memory
    const messages = createMessagesExceedingThreshold(10, threadId);

    const storageStatus = await om.getStatus({ threadId });
    expect(storageStatus.pendingTokens).toBe(0); // nothing in storage

    const inMemoryStatus = await om.getStatus({ threadId, messages });
    expect(inMemoryStatus.pendingTokens).toBeGreaterThan(0); // sees the messages
  });
});

// =============================================================================
// CASE 8 — finalize() produces clean terminal state
// =============================================================================

describe('AI SDK: finalize()', () => {
  let storage: InMemoryMemory;
  const threadId = 'finalize-thread';

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  it('activates remaining chunks and observes if threshold crossed', async () => {
    // Low threshold so observe triggers
    const om = createOM(storage, { messageTokens: 50, bufferTokens: 0.2 });

    await storage.saveMessages({ messages: createMessagesExceedingThreshold(5, threadId) });
    await om.buffer({ threadId });

    // Before finalize: chunks exist, pending tokens > 0
    const before = await om.getStatus({ threadId });
    expect(before.canActivate).toBe(true);
    expect(before.pendingTokens).toBeGreaterThan(0);

    const result = await om.finalize({ threadId });

    expect(result.activated).toBe(true);
    expect(result.record.activeObservations).toBeTruthy();

    // After finalize: clean state
    const after = await om.getStatus({ threadId });
    expect(after.canActivate).toBe(false);
    expect(after.bufferedChunkCount).toBe(0);
  });

  it('is a no-op when nothing to activate or observe', async () => {
    const om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });

    const result = await om.finalize({ threadId });

    expect(result.activated).toBe(false);
    expect(result.observed).toBe(false);
  });

  it('only activates when below observe threshold', async () => {
    // High threshold so observe doesn't trigger, but buffer+activate works
    const om = createOM(storage, { messageTokens: 500, bufferTokens: 0.2 });

    await storage.saveMessages({ messages: createMessagesExceedingThreshold(5, threadId) });
    await om.buffer({ threadId });

    const result = await om.finalize({ threadId });

    expect(result.activated).toBe(true);
    expect(result.observed).toBe(false);
    expect(result.record.activeObservations).toBeTruthy();

    const after = await om.getStatus({ threadId });
    expect(after.canActivate).toBe(false);
    expect(after.bufferedChunkCount).toBe(0);
  });
});
