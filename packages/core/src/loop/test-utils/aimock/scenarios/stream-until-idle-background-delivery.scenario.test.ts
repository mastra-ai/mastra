import { it, expect } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  runLoopScenario,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * An `untilIdle` stream sends a follow-up model request for each background task it sees finish,
 * so the model can report the result. When a model request in the same run already carried that
 * result, the follow-up makes the model answer twice: once for an awaited tool, whose tool call
 * waits for the task (COR-1379), and once for a deferred task that finished while its run was
 * still going (GRWTH-2074). A task whose result never reached a model request still needs the
 * follow-up.
 */

// A wrapper that never closes fails the test by its timeout instead of a wall-clock assertion.
const BG_CONFIG = { enabled: true, untilIdleMaxIdleMs: 60_000 };
const TEST_TIMEOUT_MS = 30_000;
const ANSWER = 'The record amount is 42.';

type Chunk = { type: string; payload?: any };
type ChatMessage = { role: string; content?: unknown };
type ChatRequest = { body: { messages: ChatMessage[] } };

async function collect(stream: AsyncIterable<unknown>): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
  for await (const chunk of stream) chunks.push(chunk as Chunk);
  return chunks;
}

const answers = (chunks: Chunk[]) =>
  chunks
    .filter(c => c.type === 'text-delta')
    .map(c => c.payload?.text ?? '')
    .join('')
    .split(ANSWER).length - 1;

/** Tool messages the model received in one request, as JSON text. */
const toolContents = (req: unknown) =>
  ((req as { messages?: ChatMessage[] })?.messages ?? [])
    .filter(m => m.role === 'tool')
    .map(m => JSON.stringify(m.content));

/** Requests that belong to this test's prompt; a leftover run from another test can reach the shared mock. */
const requestsFor = (requests: unknown[], prompt: string) =>
  (requests as ChatRequest[]).filter(r => JSON.stringify(r.body.messages).includes(prompt));

function fetchRecordTool(options: { fail?: boolean } = {}) {
  return createTool({
    id: 'fetch-record',
    description: 'Fetch a record by name',
    inputSchema: z.object({ name: z.string() }),
    background: { enabled: true, maxRetries: 0 },
    execute: async ({ name }) => {
      await new Promise(resolve => setTimeout(resolve, 50));
      if (options.fail) throw new Error('record store unavailable');
      return { name, amount: 42 };
    },
  });
}

describeForAllEngines(
  'AIMock scenario: untilIdle answers once when the model already saw a background result',
  engine => {
    const getMock = useLoopScenarioAimock();

    /**
     * Scripts an awaited `fetch-record` call: the model calls the tool, then answers as soon as a
     * request carries the real result or the failure.
     */
    function scriptAwaitedTurns(llm: ReturnType<typeof getMock>, prompt: string) {
      const mentions = (req: unknown) => JSON.stringify(req).includes(prompt);
      const sawOutcome = (req: unknown) =>
        toolContents(req).some(c => c.includes('amount') || c.includes('record store unavailable'));
      llm.on(
        { endpoint: 'chat', predicate: (req: unknown) => mentions(req) && toolContents(req).length === 0 },
        {
          toolCalls: [
            {
              id: 'call-fetch-1',
              name: 'fetch-record',
              arguments: { name: 'invoice', _background: { disposition: 'awaited' } },
            },
          ],
        },
      );
      llm.on({ endpoint: 'chat', predicate: (req: unknown) => mentions(req) && sawOutcome(req) }, { content: ANSWER });
    }

    async function runAwaited(prompt: string, options: { fail?: boolean; maxSteps?: number } = {}) {
      const { output, llm } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt,
        tools: { 'fetch-record': fetchRecordTool({ fail: options.fail }) },
        agentBackgroundTasks: { tools: { 'fetch-record': true } },
        backgroundTasks: BG_CONFIG,
        memory: new MockMemory(),
        threadId: `delivery-${engine}-${prompt}`,
        resourceId: 'delivery-user',
        maxSteps: options.maxSteps ?? 5,
        streamUntilIdle: true,
        manualStreamConsumption: true,
        fixtures: llm => scriptAwaitedTurns(llm, prompt),
      });
      const chunks = await collect(output.fullStream as AsyncIterable<unknown>);
      return { chunks, requests: requestsFor(llm.getRequests(), prompt) };
    }

    // The awaited tool call hands the real result to the model, so no follow-up request is needed. (COR-1379)
    it(
      'answers an awaited background tool once',
      async () => {
        const prompt = 'Look up the invoice record.';
        const { chunks, requests } = await runAwaited(prompt);

        expect(answers(chunks)).toBe(1);
        expect(requests).toHaveLength(2);
        expect(requests.map(r => r.body.messages.at(-1)?.role)).not.toContain('assistant');
        // The caller still sees the task finish.
        expect(chunks.some(c => c.type === 'background-task-completed')).toBe(true);
        expect(JSON.stringify(chunks)).not.toContain('backgroundResultTaskIds');
      },
      TEST_TIMEOUT_MS,
    );

    // Durable and evented fail the whole run when an awaited background task fails (COR-1243).
    const itFailsOnDurable = isDurableEngineVariant(engine) ? it.fails : it;
    itFailsOnDurable(
      'answers a failed awaited background tool once',
      async () => {
        const prompt = 'Look up the failing invoice record.';
        const { chunks, requests } = await runAwaited(prompt, { fail: true });

        expect(chunks.some(c => c.type === 'error')).toBe(false);
        expect(answers(chunks)).toBe(1);
        expect(requests).toHaveLength(2);
      },
      TEST_TIMEOUT_MS,
    );

    // The run stops right after the tool call, so only the follow-up request can report the result.
    it(
      'still reports an awaited result that no model request carried',
      async () => {
        const prompt = 'Look up the invoice record in one step.';
        const { chunks, requests } = await runAwaited(prompt, { maxSteps: 1 });

        expect(answers(chunks)).toBe(1);
        expect(requests).toHaveLength(2);
      },
      TEST_TIMEOUT_MS,
    );

    // A deferred task that finishes while a slow tool runs is already in the next request's prompt. (GRWTH-2074)
    it(
      'answers a deferred task that finished during the run once',
      async () => {
        const prompt = 'Fetch the invoice record and then the slow audit.';
        const llm = getMock();
        let recordFinished!: () => void;
        const recordReported = new Promise<void>(resolve => (recordFinished = resolve));
        const slowAudit = createTool({
          id: 'slow-audit',
          description: 'Run a slow audit',
          inputSchema: z.object({}),
          execute: async () => {
            // Returns only once the record's completion was published, which happens after its result
            // replaced the placeholder in the conversation.
            await recordReported;
            return { audit: 'clean' };
          },
        });
        const shared = await createSharedAgent(llm, {
          tools: { 'fetch-record': fetchRecordTool(), 'slow-audit': slowAudit },
          agentBackgroundTasks: { tools: { 'fetch-record': true } },
          backgroundTasks: BG_CONFIG,
          memory: new MockMemory(),
          engine,
        });
        const events = shared.mastra.backgroundTaskManager
          .stream({ resourceId: 'delivery-user', includeExisting: false })
          .getReader();
        void (async () => {
          for (;;) {
            const { done, value } = await events.read();
            if (done) return;
            if (value.type === 'background-task-completed') return recordFinished();
          }
        })();

        const mentions = (req: unknown) => JSON.stringify(req).includes(prompt);
        const sawAudit = (req: unknown) => toolContents(req).some(c => c.includes('clean'));
        llm.on(
          { endpoint: 'chat', predicate: (req: unknown) => mentions(req) && toolContents(req).length === 0 },
          {
            toolCalls: [
              {
                id: 'call-fetch-1',
                name: 'fetch-record',
                arguments: { name: 'invoice', _background: { disposition: 'deferred' } },
              },
            ],
          },
        );
        llm.on(
          {
            endpoint: 'chat',
            predicate: (req: unknown) => mentions(req) && toolContents(req).length === 1 && !sawAudit(req),
          },
          { toolCalls: [{ id: 'call-audit-1', name: 'slow-audit', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', predicate: (req: unknown) => mentions(req) && sawAudit(req) }, { content: ANSWER });

        const { output } = await runLoopScenario({
          engine,
          llm,
          prompt,
          sharedAgent: shared,
          memory: new MockMemory(),
          threadId: `delivery-${engine}-deferred`,
          resourceId: 'delivery-user',
          maxSteps: 5,
          streamUntilIdle: true,
          manualStreamConsumption: true,
          fixtures: () => {},
        });
        const chunks = await collect(output.fullStream as AsyncIterable<unknown>);
        await events.cancel();

        const requests = requestsFor(llm.getRequests(), prompt);
        // The answering request already carried the record's real result.
        expect(toolContents(requests[2]!.body).some(c => c.includes('amount'))).toBe(true);
        expect(answers(chunks)).toBe(1);
        expect(requests).toHaveLength(3);
      },
      TEST_TIMEOUT_MS,
    );
  },
  // The shared Inngest Mastra is built without per-scenario `backgroundTasks` config.
  { skip: ['inngest'] },
);
