/**
 * Reproduction + fix verification for issue #17933:
 * "Converting circular structure to JSON" when an input processor is composed as a
 * workflow while Observational Memory is enabled.
 *
 * Real path (no synthetic circular objects):
 *  - An agent has Observational Memory enabled. OM's processor builds a real
 *    `ObservationTurn`, and `turn.step(n)` wires up an `ObservationStep`, creating the
 *    `ObservationTurn._currentStep -> ObservationStep.turn -> ObservationTurn` cycle.
 *  - OM stashes the live turn in the shared processor-state map (`state.__omTurn`) so the
 *    input and output OM processor instances can share it within one request.
 *  - A second input processor is composed as a workflow (the documented "run guardrails in
 *    parallel" pattern). The agent runs all input processors as a combined
 *    `${id}-input-processor` workflow; the guardrails workflow becomes a nested workflow
 *    whose pending snapshot carries the processor state in `context.input`.
 *  - Serializing that snapshot reaches the OM cycle and used to throw.
 *
 * The fix is at the source: `ObservationTurn`/`ObservationStep` project to a minimal, acyclic
 * representation via `toJSON()`, so any `JSON.stringify` of a snapshot that happens to carry a
 * turn produces a correct, lossless value instead of crashing.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { InputProcessorOrWorkflow } from '@mastra/core/processors';
import { ProcessorStepSchema } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Memory } from '../../../index';
import { ObservationStep } from '../observation-turn/step';
import { ObservationTurn } from '../observation-turn/turn';

function createMockAgentModel(responseText: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      text: responseText,
      content: [{ type: 'text' as const, text: responseText }],
      warnings: [],
    }),
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        { type: 'response-metadata' as const, id: 'mock-response', modelId: 'mock-model', timestamp: new Date(0) },
        { type: 'text-start' as const, id: 'text-1' },
        { type: 'text-delta' as const, id: 'text-1', delta: responseText },
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

function createMockObserverModel() {
  const text = `<observations>
## January 28, 2026
### Thread: test
- 🔴 User asked for help
</observations>
<current-task>Help</current-task>`;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      throw new Error('Unexpected doGenerate call — OM should use the stream path');
    },
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'obs-1', modelId: 'mock-observer-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

const longResponseText =
  `I understand your request completely. Let me provide you with a comprehensive and detailed ` +
  `response that covers all the important aspects of what you asked about. Here are my thoughts ` +
  `and recommendations based on the information you provided.`;

// A trivial input processor composed as a workflow — the documented guardrails-in-parallel
// pattern, minimised to a single pass-through step. It is detected as a ProcessorWorkflow.
function createGuardrailWorkflow(): InputProcessorOrWorkflow {
  return createWorkflow({
    id: 'input-guardrails',
    inputSchema: ProcessorStepSchema,
    outputSchema: ProcessorStepSchema,
  })
    .then(createStep({ id: 'guard', processInput: async ({ messages }) => messages }))
    .commit() as unknown as InputProcessorOrWorkflow;
}

// Recursively look for the ObservationTurn projection produced by `ObservationTurn.toJSON()`.
function findTurnProjection(value: unknown, seen = new Set<unknown>()): Record<string, unknown> | undefined {
  if (value === null || typeof value !== 'object' || seen.has(value)) return undefined;
  seen.add(value);
  const obj = value as Record<string, unknown>;
  if (obj.threadId === 'thread-1' && typeof obj.started === 'boolean' && typeof obj.ended === 'boolean') {
    return obj;
  }
  for (const child of Object.values(obj)) {
    const found = findTurnProjection(child, seen);
    if (found) return found;
  }
  return undefined;
}

describe('processor workflow + observational memory (issue #17933)', () => {
  let store: InMemoryStore;
  let memory: Memory;

  beforeEach(() => {
    store = new InMemoryStore();
    memory = new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          observation: {
            model: createMockObserverModel() as any,
            messageTokens: 20,
            bufferTokens: false,
          },
          reflection: {
            observationTokens: 50000,
          },
        },
      },
    });
  });

  // Make the workflows store serialize the snapshot the way a standard SQL adapter (e.g. pg) does:
  // a plain JSON.stringify with no circular-safe replacer. libsql's safeStringify hides the bug by
  // silently rewriting cycles to "[Circular]" — that lossy behaviour is exactly what we must NOT
  // rely on. Capture every snapshot so the test can prove they round-trip losslessly. If a snapshot
  // is unserializable, report which top-level field still holds the cycle.
  async function captureSnapshotSerialization(storage: InMemoryStore) {
    // Capture the serialized string at persist time — the live snapshot objects are mutated
    // later in the run (e.g. the turn is cleared on end()), so a post-run reference is stale.
    const captured: string[] = [];
    const workflowsStore: any = await storage.getStore('workflows');
    const original = workflowsStore.persistWorkflowSnapshot.bind(workflowsStore);
    vi.spyOn(workflowsStore, 'persistWorkflowSnapshot').mockImplementation(async (args: any) => {
      try {
        captured.push(JSON.stringify(args.snapshot));
      } catch (error) {
        const circularFields = Object.keys(args.snapshot ?? {}).filter(field => {
          try {
            JSON.stringify(args.snapshot[field]);
            return false;
          } catch {
            return true;
          }
        });
        throw new Error(
          `Snapshot for "${args.workflowName}" (status: ${args.snapshot?.status}) is not JSON-serializable. ` +
            `Circular field(s): [${circularFields.join(', ')}]. Cause: ${(error as Error).message}`,
        );
      }
      return original(args);
    });
    return captured;
  }

  it('serializes the workflow snapshot losslessly with a workflow-composed input processor', async () => {
    const agent = new Agent({
      id: 'om-guardrails-agent',
      name: 'om-guardrails-agent',
      instructions: 'You are a helpful assistant.',
      model: createMockAgentModel(longResponseText) as any,
      memory,
      inputProcessors: [createGuardrailWorkflow()],
    });
    const mastra = new Mastra({
      agents: { 'om-guardrails-agent': agent },
      storage: store,
      logger: false,
    });
    const snapshots = await captureSnapshotSerialization(store);

    // Before the fix this rejects with "Converting circular structure to JSON".
    const result = await mastra
      .getAgent('om-guardrails-agent')
      .generate('Hello, I need help with something important.', {
        memory: { thread: 'thread-1', resource: 'resource-1' },
      });
    expect(result.text).toBeTruthy();

    // Losslessness: the turn rode into at least one persisted snapshot, and that snapshot
    // round-trips to a CORRECT, acyclic projection of the turn — not a "[Circular]" stub.
    const turnProjection = snapshots.map(s => findTurnProjection(JSON.parse(s))).find(Boolean);
    expect(turnProjection).toBeDefined();
    expect(turnProjection).toMatchObject({ threadId: 'thread-1', resourceId: 'resource-1', started: true });
    // No mangled circular markers leaked into any snapshot.
    for (const snapshot of snapshots) {
      expect(snapshot).not.toContain('[Circular]');
    }

    // The real Observational Memory record persisted correctly through the run.
    const memoryStore = await store.getStore('memory');
    const record = await memoryStore!.getObservationalMemory('thread-1', 'resource-1');
    expect(record).toBeTruthy();
  });
});

describe('ObservationTurn/ObservationStep serialization contract', () => {
  it('projects the turn<->step cycle to a minimal acyclic value without mutating the live objects', () => {
    const turn = new ObservationTurn({
      om: { scope: 'thread' } as any,
      threadId: 'thread-1',
      resourceId: 'resource-1',
      messageList: {} as any,
    });
    // Reproduce the real cycle: turn._currentStep -> step.turn -> turn.
    const step = new ObservationStep(turn, 2);
    (turn as unknown as { _currentStep: ObservationStep })._currentStep = step;

    // Sanity: the raw cycle is what JSON.stringify chokes on without toJSON.
    expect(turn.currentStep).toBe(step);

    // toJSON breaks the cycle and yields a correct, acyclic projection.
    expect(() => JSON.stringify(turn)).not.toThrow();
    expect(JSON.parse(JSON.stringify(turn))).toEqual({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      started: false,
      ended: false,
      currentStepNumber: 2,
    });

    expect(() => JSON.stringify(step)).not.toThrow();
    expect(JSON.parse(JSON.stringify(step))).toEqual({ stepNumber: 2, prepared: false });

    // The live objects are untouched — toJSON only changes the JSON projection.
    expect(turn.currentStep).toBe(step);
    expect(step.stepNumber).toBe(2);
  });
});
