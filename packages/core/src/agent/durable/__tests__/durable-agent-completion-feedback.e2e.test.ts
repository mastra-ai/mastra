/**
 * Port of harness case T78 (completion feedback with a real model, no structured output — the F5 shape).
 *
 * An `isTaskComplete` scorer fails once and then passes. Its feedback lands as a trailing assistant
 * message, so the follow-up request ends on an assistant turn. Anthropic rejects that with a prefill
 * 400; the default `PrefillErrorHandler` must repair it and the run must complete (COR-1312). The case
 * runs on the plain, durable and evented engines. Anthropic is the discriminator; OpenAI is the
 * control that must keep working.
 *
 * Replay is the default: provider traffic is served from
 * `packages/core/__recordings__/core-src-agent-durable-__tests__-durable-agent-completion-feedback.e2e/`,
 * so PR CI runs this without API keys. Recordings include the rejected 400 and the repaired retry.
 *
 * To re-record (needs both OPENAI_API_KEY and ANTHROPIC_API_KEY), from `packages/core`:
 *
 *   LLM_TEST_MODE=record pnpm vitest run --project 'e2e:packages/core' \
 *     src/agent/durable/__tests__/durable-agent-completion-feedback.e2e.test.ts
 *
 * Only commit recordings from a run where every cell passed. Before committing, check them for
 * secrets and remove the `anthropic-organization-id` / `anthropic-workspace-id` response headers.
 *
 * Replay uses exact request matching. If replay fails with "No exact match for hash", a request body
 * changed (for example the completion-feedback template); re-record.
 */
import { join } from 'node:path';
import { defaultNameGenerator, getLLMRecordingsDir, getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, setupDummyApiKeys } from '@internal/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createScorer } from '../../../evals';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage/mock';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

const MODE = getLLMTestMode();
setupDummyApiKeys(MODE, ['openai', 'anthropic']);

const PROVIDERS = {
  anthropic: 'anthropic/claude-sonnet-4-6',
  openai: 'openai/gpt-5-mini',
} as const;
const ENGINES = ['plain', 'durable', 'evented'] as const;

const OMEGA_FEEDBACK = 'The reply is missing the required word OMEGA.';
const PREFILL_REPAIR_MARKER = 'anthropic-prefill-processor-retry';

// The completion feedback embeds the check's wall-clock duration ("Duration: 1ms"), which would
// otherwise change the request hash between runs.
const normalizeCompletionDuration = ({ url, body }: { url: string; body: unknown }) => ({
  url,
  body: JSON.parse(JSON.stringify(body).replace(/Duration: \d+ms/g, 'Duration: 0ms')),
});

type ModelRequest = { endpoint: string; body: any; status: number; responseText?: string };

// Role of the final conversational item a request ends on. OpenAI Responses `item_reference` ids
// prefixed `msg_` point at a prior assistant message.
function lastTurn(body: any): string | null {
  const items = body?.messages ?? body?.input ?? [];
  const last = items.at(-1);
  if (!last) return null;
  if (last.type === 'item_reference') return String(last.id).startsWith('msg_') ? 'assistant' : 'reference';
  return last.role ?? last.type ?? null;
}

// An Anthropic request ending on an assistant turn may be attempted, as long as the very next request
// carries the prefill repair and no longer ends on the assistant. A repair with no such request in
// front of it is spurious.
function prefillRepairs(requests: ModelRequest[]) {
  const reqs = requests.map((r, i) => ({
    i,
    provider: r.endpoint.includes('anthropic') ? 'anthropic' : 'openai',
    last: lastTurn(r.body),
    status: r.status,
    repair: JSON.stringify(r.body ?? '').includes(PREFILL_REPAIR_MARKER),
  }));
  const ended = reqs.filter(r => r.provider === 'anthropic' && r.last === 'assistant');
  const isRepairOf = (r: (typeof reqs)[number]) => {
    const next = reqs[r.i + 1];
    return !!next && next.repair && next.last !== 'assistant';
  };
  const repairIdx = new Set(ended.filter(isRepairOf).map(r => r.i + 1));
  return {
    ended,
    repaired: ended.filter(isRepairOf),
    unrepaired: ended.filter(r => !isRepairOf(r)),
    spurious: reqs.filter(r => r.repair && !repairIdx.has(r.i)),
  };
}

// Requests that end on an assistant turn, split by provider. Anthropic rejects these (the prefill 400
// the repair has to fix); OpenAI accepts a wake-up ending on an assistant `item_reference`, so those
// are reported separately. This is the harness's `assistantEndedAccepted` observation.
function assistantEndedRequests(requests: ModelRequest[]) {
  const ended = requests
    .map((r, i) => ({
      i,
      provider: r.endpoint.includes('anthropic') ? 'anthropic' : 'openai',
      last: lastTurn(r.body),
    }))
    .filter(r => r.last === 'assistant');
  return {
    rejected: ended.filter(r => r.provider === 'anthropic'),
    accepted: ended.filter(r => r.provider !== 'anthropic'),
  };
}

function createOmegaScorer(scores: number[]) {
  return createScorer({ id: 't78-scorer', description: 'requires OMEGA after one failure' })
    .generateScore(async () => {
      const score = scores.length >= 1 ? 1 : 0;
      scores.push(score);
      return score;
    })
    .generateReason(async ({ score }) => (score ? 'complete' : OMEGA_FEEDBACK));
}

describe.each(Object.entries(PROVIDERS))('T78 completion feedback — %s', (provider, model) => {
  describe.each(ENGINES)('%s engine', engine => {
    let mock: ReturnType<typeof createGatewayMock>;
    let originalFetch: typeof fetch;
    let requests: ModelRequest[];

    beforeEach(c => {
      mock = createGatewayMock({
        name: `${provider}-${engine}`,
        exactMatch: true,
        transformRequest: normalizeCompletionDuration,
        recordingsDir: join(getLLMRecordingsDir(c.task.file.filepath), defaultNameGenerator(c.task.file.filepath)),
      });
      mock.start();

      // Observe every provider request and its status on top of the recorder, in both record and
      // replay mode. In record mode the recorder re-issues each request through MSW's `bypass()`, which
      // tags it with `accept: msw/passthrough`; skip those so each request is counted once.
      requests = [];
      originalFetch = globalThis.fetch;
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const response = await originalFetch(input, init);
        const isBypass = input instanceof Request && !!input.headers.get('accept')?.includes('msw/passthrough');
        const url = new URL(input instanceof Request ? input.url : input);
        if (!isBypass && ['api.openai.com', 'api.anthropic.com'].includes(url.hostname)) {
          const entry: ModelRequest = {
            endpoint: url.origin + url.pathname,
            body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
            status: response.status,
          };
          if (!response.ok) entry.responseText = await response.clone().text();
          requests.push(entry);
        }
        return response;
      }) as typeof fetch;
    });

    afterEach(async () => {
      globalThis.fetch = originalFetch;
      await mock.saveAndStop();
    });

    it('repairs the prefill rejection and completes after one failed completion check', async () => {
      const scores: number[] = [];
      const onComplete: boolean[] = [];
      const storage = new InMemoryStore();
      const memory = new MockMemory({
        storage,
        options: { lastMessages: 40, semanticRecall: false, generateTitle: false },
      });
      const agent = new Agent({
        id: `t78-${provider}-${engine}`,
        name: 't78',
        model,
        memory,
        instructions: 'Answer briefly. If you receive completion feedback, follow it exactly.',
        defaultOptions: {
          isTaskComplete: {
            scorers: [createOmegaScorer(scores)],
            onComplete: r => {
              onComplete.push(r.complete);
            },
          },
        },
      });
      const runner =
        engine === 'plain'
          ? agent
          : engine === 'durable'
            ? createDurableAgent({ agent })
            : createEventedAgent({ agent });
      const mastra = new Mastra({ agents: { t78: runner as any }, storage, logger: false });
      if (engine !== 'plain') {
        expect((runner as any).getWorkflow().engineType).toBe(engine === 'evented' ? 'evented' : 'default');
      }

      const thread = `t78-thread-${provider}-${engine}`;
      const resource = `t78-resource-${provider}-${engine}`;
      const chunks: any[] = [];
      let threw: string | null = null;
      try {
        const result: any = await runner.stream(
          'Give a one-sentence reply containing the word ALPHA, and the number 7.',
          { memory: { thread, resource }, maxSteps: 4 } as any,
        );
        const output = engine === 'plain' || !result.output ? result : result.output;
        for await (const chunk of output.fullStream) chunks.push(chunk);
        result.cleanup?.();
      } catch (err: any) {
        threw = String(err?.message ?? err);
      }
      await mastra.stopWorkers?.();

      const errors = chunks
        .filter(c => c.type === 'error')
        .map(c => String(c.payload?.error?.message ?? c.payload?.error ?? ''));
      const finalText = chunks
        .filter(c => c.type === 'text-delta')
        .map(c => c.payload?.text ?? '')
        .join('');
      const bodies = requests.map(r => JSON.stringify(r.body ?? ''));
      const repairs = prefillRepairs(requests);
      // Read everything stored, including signals that recall() hides by default.
      const recalled = await memory.recall({ threadId: thread, resourceId: resource, perPage: 50, hideSignals: false });

      // 1. Every Anthropic request ending on an assistant turn was repaired (F5, COR-1312).
      expect(repairs.unrepaired).toEqual([]);
      // 2. No prefill repair without a rejected request in front of it (control).
      expect(repairs.spurious).toEqual([]);
      // 3. No assistant-prefill rejection surfaced.
      expect([...errors, threw ?? ''].filter(m => /prefill|assistant message/i.test(m))).toEqual([]);
      // 4. No error chunk (and the stream did not reject).
      expect(errors).toEqual([]);
      expect(threw).toBeNull();
      // 5. The run produced an answer.
      expect(finalText.length).toBeGreaterThan(0);
      // 6. Exercised-ness: the completion feedback was delivered to the model.
      expect(bodies.some(b => b.includes('missing the required word OMEGA'))).toBe(true);
      // 7. The scorer failed once, then passed.
      expect(scores).toEqual([0, 1]);
      // 8. The final completion check graded complete.
      expect(onComplete.at(-1)).toBe(true);
      // 9. The synthetic continuation turn is not persisted in memory. Guard against an empty history:
      // the prompt and the model's replies must be there.
      const stored = JSON.stringify(recalled.messages);
      expect(stored).toContain('Give a one-sentence reply containing the word ALPHA');
      expect(recalled.messages.some(m => m.role === 'assistant')).toBe(true);
      expect(stored).not.toContain('Continue.');

      // Anthropic must actually take the rejection -> repair path. OpenAI never rejects: an OpenAI
      // request ending on an assistant turn is accepted as-is (the control), so it must stay
      // unrepaired rather than being "fixed" before it is ever sent.
      const endedByProvider = assistantEndedRequests(requests);
      if (provider === 'anthropic') {
        expect(endedByProvider.accepted).toEqual([]);
        expect(repairs.ended.length).toBeGreaterThan(0);
        for (const { i } of repairs.ended) {
          expect(requests[i]!.status).toBe(400);
          expect(requests[i]!.responseText).toMatch(/does not support assistant message prefill/);
        }
        expect(repairs.repaired.length).toBe(repairs.ended.length);
      } else {
        expect(repairs.ended).toEqual([]);
        expect(repairs.spurious).toEqual([]);
        // The control has to see the contrast: an assistant-ended OpenAI request that the provider
        // accepted (200) and that was not pre-repaired.
        expect(endedByProvider.accepted.length).toBeGreaterThan(0);
        for (const { i } of endedByProvider.accepted) {
          expect(requests[i]!.status).toBe(200);
          expect(bodies[i]!).not.toContain(PREFILL_REPAIR_MARKER);
        }
      }
    }, 120_000);
  });
});
