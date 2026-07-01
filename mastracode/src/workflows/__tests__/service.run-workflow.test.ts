/**
 * Repro test for `/workflows run <id> <json>` failing with:
 *   "No model selected. Use /models to select a model first."
 *
 * The slash handler builds a synthetic `RequestContext` with
 * `controller.session.modelId` set from the current session, then calls
 * `runWorkflow(mastra, id, inputData, requestContext)` in
 * `mastracode/src/workflows/service.ts`. Three fix attempts have been made
 * but the runtime error persists.
 *
 * Rather than theorising further, this test builds an isolated Mastra
 * that mirrors mastracode's runtime for the code-agent path and asserts
 * `runWorkflow` behavior under three request-context shapes.
 *
 * If the "populated modelId" case passes here, my previous fixes work in
 * theory and the user's persistent runtime error is a deployment / stale
 * build issue. If it fails, the propagation chain has a break the earlier
 * audit missed and we go find it.
 */
import { randomUUID } from 'node:crypto';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { ProcessInputArgs, Processor } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { beforeEach, describe, expect, it } from 'vitest';

import { runWorkflow } from '../service.js';

// ============================================================================
// Test doubles
// ============================================================================

/**
 * Mimics `mastracode/src/agents/model.ts:getDynamicModel` — reads
 * `controller.session.modelId` off requestContext, throws the exact error
 * users see when it's empty. Returns a mock LanguageModelV2 that emits a
 * short "hello" so the agent step can complete.
 */
function fakeGetDynamicModel({ requestContext }: { requestContext: { get: (k: string) => unknown } }) {
  const controllerCtx = requestContext.get('controller') as { session?: { modelId?: string } } | undefined;
  const modelId = controllerCtx?.session?.modelId;
  if (!modelId) {
    throw new Error('No model selected. Use /models to select a model first.');
  }
  return new MastraLanguageModelV2Mock({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({
            type: 'response-metadata',
            id: 'id-0',
            modelId: 'mock',
            timestamp: new Date(0),
          });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'hello' });
          controller.enqueue({ type: 'text-end', id: 'text-1' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          });
          controller.close();
        },
      }),
    }),
  }) as any;
}

// ============================================================================
// Test workflow — mirrors the failing user workflow (mapping + agent step)
// ============================================================================

const WORKFLOW_ID = 'say-hi';

const testGraph: SerializedStepFlowEntry[] = [
  {
    type: 'mapping',
    id: 'build-prompt',
    mapConfig: JSON.stringify({
      prompt: { template: 'Say hi to ${inputData.name}.' },
    }),
  },
  { type: 'agent', id: 'code-agent', agentId: 'code-agent' },
];

const inputSchema = {
  type: 'object',
  properties: { name: { type: 'string' } },
  required: ['name'],
};
const outputSchema = {
  type: 'object',
  properties: { text: { type: 'string' } },
  required: ['text'],
};

// ============================================================================
// Test setup
// ============================================================================

async function buildMastra(): Promise<Mastra> {
  const codeAgent = new Agent({
    id: 'code-agent',
    name: 'Code Agent',
    instructions: 'You are a friendly assistant.',
    model: fakeGetDynamicModel,
  } as any);

  const mastra = new Mastra({
    logger: false,
    agents: { 'code-agent': codeAgent },
    storage: new InMemoryStore({ id: 'test-store' }),
  });

  await (mastra as any).addStoredWorkflow({
    id: WORKFLOW_ID,
    description: 'Says hi to a name using the code-agent.',
    inputSchema,
    outputSchema,
    graph: testGraph,
  });

  return mastra;
}

// ============================================================================
// Cases
// ============================================================================

describe('runWorkflow — code-agent model resolution', () => {
  let mastra: Mastra;

  beforeEach(async () => {
    mastra = await buildMastra();
  });

  it('fails when no requestContext is passed (baseline — asserts the throw is coming from the right place)', async () => {
    const result = (await runWorkflow(mastra, WORKFLOW_ID, { name: 'Tony' })) as {
      status: string;
      error?: { message?: string };
    };
    expect(result.status).toBe('failed');
    expect(result.error?.message ?? '').toContain('No model selected');
  });

  it('fails when requestContext.controller.session.modelId is empty (regression guard)', async () => {
    const rc = new RequestContext();
    rc.set('controller', { session: { modelId: '' } });

    const result = (await runWorkflow(mastra, WORKFLOW_ID, { name: 'Tony' }, rc)) as {
      status: string;
      error?: { message?: string };
    };
    expect(result.status).toBe('failed');
    expect(result.error?.message ?? '').toContain('No model selected');
  });

  it('succeeds when requestContext.controller.session.modelId is set — THIS IS THE ONE THAT DECIDES THE FIX', async () => {
    const rc = new RequestContext();
    rc.set('controller', { session: { modelId: 'openai/gpt-5.5' }, state: {} });

    const result = (await runWorkflow(mastra, WORKFLOW_ID, { name: 'Tony' }, rc)) as {
      status: string;
      result?: { text?: string };
      error?: { message?: string };
    };

    // If this fails with "No model selected", the requestContext isn't reaching
    // agent.stream() — the earlier propagation-chain audit was wrong.
    if (result.status !== 'success') {
      throw new Error(
        `Expected success, got ${result.status}. error=${JSON.stringify(result.error)}\n` +
          `Full result: ${JSON.stringify(result, null, 2)}`,
      );
    }
    expect(result.status).toBe('success');
    expect(result.result?.text).toBeDefined();
  });
});

// ============================================================================
// Second reproduction: memory-processor requiring MastraMemory.thread.id
// ============================================================================

/**
 * Fake input processor that mimics `ObservationalMemory`'s failure mode: reads
 * `requestContext.get('MastraMemory')?.thread?.id` and throws the exact error
 * users see when it's absent. Real ObservationalMemory does the same read at
 * packages/memory/src/processors/observational-memory/observational-memory.ts:1639-1675.
 */
class FakeObservationalMemoryProcessor implements Processor<'fake-observational-memory'> {
  readonly id = 'fake-observational-memory' as const;
  readonly name = 'Fake Observational Memory';

  async processInput(args: ProcessInputArgs<unknown>) {
    const memoryCtx = args.requestContext?.get('MastraMemory') as { thread?: { id?: string } } | undefined;
    const threadId = memoryCtx?.thread?.id;
    if (!threadId) {
      throw new Error(
        "ObservationalMemory (scope: 'thread') requires a threadId, but none was found in " +
          'RequestContext or MessageList. Ensure the agent is configured with Memory and a valid ' +
          'threadId is provided.',
      );
    }
    return args.messageList;
  }
}

async function buildMastraWithMemoryProcessor(): Promise<Mastra> {
  const codeAgent = new Agent({
    id: 'code-agent',
    name: 'Code Agent',
    instructions: 'You are a friendly assistant.',
    model: fakeGetDynamicModel,
    inputProcessors: [new FakeObservationalMemoryProcessor()],
  } as any);

  const mastra = new Mastra({
    logger: false,
    agents: { 'code-agent': codeAgent },
    storage: new InMemoryStore({ id: 'test-store-memory' }),
  });

  await (mastra as any).addStoredWorkflow({
    id: WORKFLOW_ID,
    description: 'Says hi to a name using the code-agent (memory-processor variant).',
    inputSchema,
    outputSchema,
    graph: testGraph,
  });

  return mastra;
}

// ============================================================================
// Third reproduction: onEvent callback wiring
// ============================================================================

describe('runWorkflow — onEvent callback', () => {
  let mastra: Mastra;

  beforeEach(async () => {
    mastra = await buildMastra();
  });

  it('receives workflow-step-start and workflow-step-result events for each step, in order', async () => {
    const rc = new RequestContext();
    rc.set('controller', { session: { modelId: 'openai/gpt-5.5' }, state: {} });

    const events: Array<{ type: string; id?: string; status?: string }> = [];
    const result = (await runWorkflow(mastra, WORKFLOW_ID, { name: 'Tony' }, rc, evt => {
      const payload = (evt as { payload?: { id?: string; status?: string } }).payload;
      events.push({ type: evt.type, id: payload?.id, status: payload?.status });
    })) as { status: string; result?: { text?: string } };

    if (result.status !== 'success') {
      throw new Error(`Expected success, got ${result.status}. events=${JSON.stringify(events, null, 2)}`);
    }

    const startEvents = events.filter(e => e.type === 'workflow-step-start');
    const resultEvents = events.filter(e => e.type === 'workflow-step-result');

    // Both step ids appear as start + result events.
    expect(startEvents.map(e => e.id)).toEqual(['build-prompt', 'code-agent']);
    expect(resultEvents.map(e => e.id)).toEqual(['build-prompt', 'code-agent']);

    // Each step-start precedes its own step-result.
    const buildStart = events.findIndex(e => e.type === 'workflow-step-start' && e.id === 'build-prompt');
    const buildResult = events.findIndex(e => e.type === 'workflow-step-result' && e.id === 'build-prompt');
    const agentStart = events.findIndex(e => e.type === 'workflow-step-start' && e.id === 'code-agent');
    const agentResult = events.findIndex(e => e.type === 'workflow-step-result' && e.id === 'code-agent');
    expect(buildStart).toBeLessThan(buildResult);
    expect(agentStart).toBeLessThan(agentResult);

    // All step-result events are 'success' on a happy path.
    expect(resultEvents.every(e => e.status === 'success')).toBe(true);
  });
});

describe('runWorkflow — MastraMemory / ObservationalMemory thread requirement', () => {
  let mastra: Mastra;

  beforeEach(async () => {
    mastra = await buildMastraWithMemoryProcessor();
  });

  it('fails when MastraMemory is absent from the context (regression guard)', async () => {
    const rc = new RequestContext();
    rc.set('controller', { session: { modelId: 'openai/gpt-5.5' }, state: {} });

    const result = (await runWorkflow(mastra, WORKFLOW_ID, { name: 'Tony' }, rc)) as {
      status: string;
      error?: { message?: string; cause?: { message?: string } };
    };

    expect(result.status).toBe('failed');
    // The Agent wraps input-processor errors as "[Agent:X] - Input processor error";
    // check either the wrapper OR the underlying cause for the ObservationalMemory
    // failure signature. Any-of match keeps the assertion tolerant of framing
    // changes upstream while still asserting the failure mode.
    const errText = `${result.error?.message ?? ''}\n${result.error?.cause?.message ?? ''}`;
    const looksLikeMemoryError = errText.includes('Input processor') || errText.includes('ObservationalMemory');
    expect(looksLikeMemoryError).toBe(true);
  });

  it('succeeds when MastraMemory.thread.id is populated in the request context', async () => {
    const rc = new RequestContext();
    rc.set('controller', { session: { modelId: 'openai/gpt-5.5' }, state: {} });
    rc.set('MastraMemory', {
      thread: { id: randomUUID() },
      resourceId: 'test-resource',
      memoryConfig: undefined,
    });

    const result = (await runWorkflow(mastra, WORKFLOW_ID, { name: 'Tony' }, rc)) as {
      status: string;
      result?: { text?: string };
      error?: { message?: string };
    };

    if (result.status !== 'success') {
      throw new Error(
        `Expected success, got ${result.status}. error=${JSON.stringify(result.error)}\n` +
          `Full result: ${JSON.stringify(result, null, 2)}`,
      );
    }
    expect(result.result?.text).toBeDefined();
  });
});
