/**
 * Hook extractors run after the Observer (or Reflector) produced observations.
 * Whatever they start (the Subconscious curate and remind agents, or a user's own
 * agent call) belongs to the same trace as the memory operation that fed them,
 * so `onExtracted` receives that operation's observability context and the
 * built-in hooks pass it to the agents they run.
 *
 * Runs a real Agent + Memory + Observability turn with every model call served
 * by AIMock and asserts on the exported span tree.
 */

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { ObservabilityContext } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { Observability } from '@mastra/observability';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Memory, Subconscious } from '../../../index';
import { Extractor } from '../extractor';

const ACTOR = 'actor-model';
const OBSERVER = 'observer-model';
const CURATOR = 'curator-model';
const REMINDER = 'reminder-model';
const THREAD = 'alpha';
const RESOURCE = 'user-42';

type ExportedSpan = {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  type: SpanType;
  entityId?: string;
};

const endedSpans: ExportedSpan[] = [];
const collectingExporter = {
  name: 'collecting-exporter',
  async exportTracingEvent(event: { type: string; exportedSpan?: ExportedSpan }) {
    if (event.type === TracingEventType.SPAN_ENDED && event.exportedSpan) endedSpans.push(event.exportedSpan);
  },
  async flush() {},
  async shutdown() {},
};

let mock: LLMock;

beforeAll(async () => {
  mock = new LLMock({ port: 0 });
  await mock.start();
});

beforeEach(() => {
  endedSpans.length = 0;
  mock.clearFixtures();
  mock.clearRequests();
  mock.resetMatchCounts();
});

afterAll(async () => {
  await mock.stop();
});

async function runObservedTurn(scope: 'thread' | 'resource') {
  mock.on({ endpoint: 'chat', model: ACTOR }, { content: 'Noted, I will plan around the Atlas launch.' });
  mock.on(
    { endpoint: 'chat', model: OBSERVER, userMessage: 'Extract structured data' },
    { content: JSON.stringify({ project: 'Atlas' }) },
  );
  mock.on(
    { endpoint: 'chat', model: OBSERVER },
    {
      content:
        scope === 'thread'
          ? '<observations>\n* 🔴 User is preparing the Project Atlas launch\n</observations>'
          : `<observations>\n<thread id="${THREAD}">\n* 🔴 User is preparing the Project Atlas launch\n</thread>\n</observations>`,
    },
  );
  mock.on({ endpoint: 'chat', model: CURATOR }, { content: 'Nothing new to save.' });
  mock.on({ endpoint: 'chat', model: REMINDER }, { content: '<no-reminder />' });

  const openai = createOpenAI({ apiKey: 'test-key', baseURL: `${mock.url}/v1` });
  const hookContexts: Array<ObservabilityContext | undefined> = [];
  const subconscious = new Subconscious({
    defaultScope: 'resource',
    observation: [
      { name: 'curate', model: openai.chat(CURATOR) },
      { name: 'remind', model: openai.chat(REMINDER) },
    ],
  });
  const memory = new Memory({
    storage: new InMemoryStore(),
    vector: {} as MastraVector,
    embedder: {} as MastraEmbeddingModel<string>,
    options: {
      observationalMemory: {
        enabled: true,
        scope,
        observation: {
          model: openai.chat(OBSERVER),
          messageTokens: 20,
          bufferTokens: false,
          extract: [
            new Extractor({
              name: 'Launch project',
              instructions: 'Extract the project being launched.',
              schema: z.object({ project: z.string() }),
            }),
            new Extractor({
              name: 'Trace probe',
              mode: 'hook',
              onExtracted: ({ observabilityContext }) => {
                hookContexts.push(observabilityContext);
              },
            }),
          ],
        },
        reflection: { model: openai.chat(OBSERVER), observationTokens: 100_000 },
        experimental_subconscious: subconscious,
      },
    },
  });

  // Seed a Knowledge record from another thread so the reminder has a source to check.
  const knowledge = await memory.getKnowledgeStore();
  const knowledgeScope = ['org:acme', `resource:${RESOURCE}`];
  const node = await knowledge.createNode({ name: 'Project Atlas', kind: 'project', scope: knowledgeScope });
  await knowledge.appendKnowledge({
    node,
    text: 'Project Atlas launches January 15.',
    scope: knowledgeScope,
    sourceThreadId: 'beta',
    resolutionScope: [...knowledgeScope, 'thread:beta'],
    defaultScope: knowledgeScope,
  });

  const agent = new Agent({
    id: 'actor',
    name: 'Actor',
    instructions: 'You are a helpful assistant.',
    model: openai.chat(ACTOR),
    memory,
  });
  const mastra = new Mastra({
    agents: { actor: agent },
    logger: false,
    observability: new Observability({
      configs: { default: { serviceName: 'om-hook-tracing-test', exporters: [collectingExporter] } },
    }),
  });

  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  await mastra
    .getAgent('actor')
    .generate(`Help me prepare the Project Atlas launch. ${'Every detail matters for the launch. '.repeat(10)}`, {
      memory: { thread: THREAD, resource: RESOURCE },
      requestContext,
    });

  await subconscious.settled();
  await memory.settled();
  return { hookContexts };
}

const requestsTo = (model: string) => mock.getRequests().filter(request => request.body?.model === model);
const agentRunSpan = (agentIdPrefix: string) =>
  endedSpans.find(span => span.type === SpanType.AGENT_RUN && span.entityId?.startsWith(agentIdPrefix));

describe.each(['thread', 'resource'] as const)('%s-scoped observation hooks', { timeout: 30_000 }, scope => {
  it('trace the curate and remind agents as children of the memory observe span', async () => {
    const { hookContexts } = await runObservedTurn(scope);

    expect(requestsTo(CURATOR).length).toBeGreaterThan(0);
    expect(requestsTo(REMINDER).length).toBeGreaterThan(0);
    await vi.waitFor(() => {
      expect(agentRunSpan('subconscious-curate-')).toBeDefined();
      expect(agentRunSpan('subconscious-remind-')).toBeDefined();
    });

    const observeSpan = endedSpans.find(span => span.name.startsWith('memory: observe'));
    const actorSpan = agentRunSpan('actor');
    expect(observeSpan).toBeDefined();
    expect(actorSpan).toBeDefined();
    expect(observeSpan!.traceId).toBe(actorSpan!.traceId);

    for (const sidekick of [agentRunSpan('subconscious-curate-')!, agentRunSpan('subconscious-remind-')!]) {
      expect(sidekick.traceId).toBe(observeSpan!.traceId);
      expect(sidekick.parentSpanId).toBe(observeSpan!.id);
    }

    // The structured extraction call is part of the observe operation too.
    expect(requestsTo(OBSERVER).some(request => JSON.stringify(request.body).includes('Extract structured data'))).toBe(
      true,
    );
    // Observer run + structured extraction run, both inside the observe operation.
    const observerAgentRuns = endedSpans.filter(
      span => span.type === SpanType.AGENT_RUN && span.entityId === 'observational-memory-observer',
    );
    expect(observerAgentRuns).toHaveLength(2);
    expect(observerAgentRuns.every(span => span.parentSpanId === observeSpan!.id)).toBe(true);

    expect(hookContexts).toHaveLength(1);
    const hookSpan = hookContexts[0]?.tracingContext?.currentSpan;
    expect(hookSpan?.id).toBe(observeSpan!.id);
  });
});
