import { it, expect } from 'vitest';
import { z } from 'zod';
import type { Mastra } from '../../../../mastra';
import { MockMemory } from '../../../../memory/mock';
import type { Processor } from '../../../../processors';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  runLoopScenario,
  useLoopScenarioAimock,
} from '../aimock-scenario';

// A wrapper that never closes fails the test by its timeout instead of a wall-clock assertion.
const BG_CONFIG = { enabled: true, untilIdleMaxIdleMs: 60_000 };
const TEST_TIMEOUT_MS = 30_000;
const ANSWER = 'The record amount is 42.';
const RESOURCE_ID = 'delivery-user';

type Chunk = { type: string; payload?: any };
type ChatMessage = { role: string; content?: unknown };
type ChatRequest = { body: { messages: ChatMessage[] } };
type Mock = Parameters<typeof runLoopScenario>[0]['llm'];

/** Reads the whole stream into an array. */
async function collect(stream: AsyncIterable<unknown>): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
  for await (const chunk of stream) chunks.push(chunk as Chunk);
  return chunks;
}

/** How many times the model gave the scripted answer across all text deltas. */
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

/** Whether a request carries the record's real result. */
const sawRecord = (req: unknown) => toolContents(req).some(c => c.includes('amount'));

/** Matches requests of the turn started with `prompt`. */
const mentions = (prompt: string) => (req: unknown) => JSON.stringify(req).includes(prompt);

/** Requests that belong to this test's prompt; a leftover run from another test can reach the shared mock. */
const requestsFor = (requests: unknown[], prompt: string) =>
  (requests as ChatRequest[]).filter(r => JSON.stringify(r.body.messages).includes(prompt));

/**
 * Subscribes to the thread's background task events. `taskId` resolves with the id of the first
 * event of `type`. Subscribe before the run starts so the event can't be missed.
 */
function nextTaskEvent(
  mastra: Mastra,
  threadId: string,
  type: string,
): { taskId: Promise<string>; stop: () => Promise<void> } {
  const events = mastra
    .backgroundTaskManager!.stream({ threadId, resourceId: RESOURCE_ID, includeExisting: false })
    .getReader();
  const taskId = (async () => {
    for (;;) {
      const { done, value } = await events.read();
      if (done) throw new Error(`background task stream ended before ${type}`);
      if (value.type === type) return (value.payload as { taskId: string }).taskId;
    }
  })();
  // A test that fails before the event arrives stops the reader; its own failure is the one to report.
  taskId.catch(() => {});
  return { taskId, stop: () => events.cancel() };
}

/**
 * A background tool that returns a record. With `fail` it throws instead; with `suspend` it asks
 * for approval first and returns the record once resumed.
 */
function fetchRecordTool(options: { fail?: boolean; suspend?: boolean } = {}) {
  return createTool({
    id: 'fetch-record',
    description: 'Fetch a record by name',
    inputSchema: z.object({ name: z.string() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    background: { enabled: true, maxRetries: 0 },
    execute: async ({ name }, context) => {
      if (options.suspend && !context?.agent?.resumeData) {
        return context?.agent?.suspend?.({ ask: 'approve the lookup' }) as never;
      }
      if (options.fail) throw new Error('record store unavailable');
      return { name, amount: 42 };
    },
  });
}

/** A foreground tool the model calls after seeing the record, before it answers. */
const auditTool = createTool({
  id: 'audit',
  description: 'Audit a record',
  inputSchema: z.object({}),
  execute: async () => ({ audit: 'clean' }),
});

/** Whether a request carries the audit result. */
const sawAudit = (req: unknown) => toolContents(req).some(c => c.includes('clean'));

/** Scripts the first request of a turn: the model calls `fetch-record` with `disposition`. */
function scriptFetchCall(llm: Mock, prompt: string, disposition: 'awaited' | 'deferred') {
  llm.on(
    {
      endpoint: 'chat',
      predicate: (req: unknown) => mentions(prompt)(req) && toolContents(req).length === 0,
    },
    {
      toolCalls: [
        { id: 'call-fetch-1', name: 'fetch-record', arguments: { name: 'invoice', _background: { disposition } } },
      ],
    },
  );
}

/**
 * An `untilIdle` stream sends a follow-up model request for each background task it sees finish,
 * so the model can report the result. When the model already answered with that result in the same
 * run, the follow-up makes it answer twice. This happens with an awaited tool, whose call waits for
 * the task (COR-1379), and with a deferred task that finished while its run was still going
 * (GRWTH-2074). A task whose result the model never answered still needs the follow-up.
 */
describeForAllEngines(
  'AIMock scenario: untilIdle reports each background result once',
  engine => {
    const getMock = useLoopScenarioAimock();

    /**
     * Runs one awaited `fetch-record` turn through `untilIdle` and returns the caller's chunks and
     * this prompt's requests. The model answers once a request carries the result or the failure;
     * with `auditFirst` it calls the foreground `audit` tool before answering.
     */
    async function runAwaited(
      prompt: string,
      options: { fail?: boolean; maxSteps?: number; auditFirst?: boolean } = {},
    ) {
      const { output, llm } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt,
        tools: { 'fetch-record': fetchRecordTool({ fail: options.fail }), audit: auditTool },
        agentBackgroundTasks: { tools: { 'fetch-record': true } },
        backgroundTasks: BG_CONFIG,
        memory: new MockMemory(),
        threadId: `delivery-${engine}-${prompt}`,
        resourceId: RESOURCE_ID,
        maxSteps: options.maxSteps ?? 5,
        streamUntilIdle: true,
        manualStreamConsumption: true,
        fixtures: llm => {
          const sawOutcome = (req: unknown) =>
            sawRecord(req) || toolContents(req).some(c => c.includes('record store unavailable'));
          scriptFetchCall(llm, prompt, 'awaited');
          if (options.auditFirst) {
            llm.on(
              {
                endpoint: 'chat',
                predicate: (req: unknown) => mentions(prompt)(req) && sawOutcome(req) && !sawAudit(req),
              },
              { toolCalls: [{ id: 'call-audit-1', name: 'audit', arguments: {} }] },
            );
          }
          llm.on(
            {
              endpoint: 'chat',
              predicate: (req: unknown) =>
                mentions(prompt)(req) && sawOutcome(req) && (!options.auditFirst || sawAudit(req)),
            },
            { content: ANSWER },
          );
        },
      });
      const chunks = await collect(output.fullStream as AsyncIterable<unknown>);
      return { chunks, requests: requestsFor(llm.getRequests(), prompt) };
    }

    // The awaited tool call hands the real result to the model, so no follow-up request is needed. (COR-1379)
    it(
      'answers once for an awaited background tool',
      async () => {
        const prompt = 'Look up the invoice record.';
        const { chunks, requests } = await runAwaited(prompt);

        expect(answers(chunks)).toBe(1);
        expect(requests).toHaveLength(2);
        // The caller still sees the task finish.
        expect(chunks.some(c => c.type === 'background-task-completed')).toBe(true);
        expect(JSON.stringify(chunks)).not.toContain('backgroundResultTaskIds');
      },
      TEST_TIMEOUT_MS,
    );

    // Durable and evented fail the whole run when an awaited background task fails (COR-1243).
    const itFailsOnDurable = isDurableEngineVariant(engine) ? it.fails : it;
    itFailsOnDurable(
      'answers once for a failed awaited background tool',
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

    // The model saw the result but called another tool, and the step limit ended the run before it
    // answered, so only the follow-up request can report the result.
    it(
      'still reports an awaited result the model saw but never answered',
      async () => {
        const prompt = 'Look up and audit the invoice record.';
        const { chunks, requests } = await runAwaited(prompt, { maxSteps: 2, auditFirst: true });

        expect(answers(chunks)).toBe(1);
        expect(requests).toHaveLength(3);
      },
      TEST_TIMEOUT_MS,
    );

    // The parked run never gets the result back, so only the follow-up request can report it.
    // Skipped on durable and evented: the parked turn never ends there, so the case can only hang
    // until the test timeout and leaves a live run behind. Not yet investigated; possibly related
    // to PLTFRM-3178.
    it.skipIf(isDurableEngineVariant(engine))(
      'still reports an awaited result answered while the run is parked',
      async () => {
        const prompt = 'Look up the invoice record after approval.';
        const threadId = `delivery-${engine}-parked`;
        const llm = getMock();
        const shared = await createSharedAgent(llm, {
          tools: { 'fetch-record': fetchRecordTool({ suspend: true }) },
          agentBackgroundTasks: { tools: { 'fetch-record': true } },
          backgroundTasks: BG_CONFIG,
          memory: new MockMemory(),
          engine,
        });
        const suspended = nextTaskEvent(shared.mastra, threadId, 'background-task-suspended');
        scriptFetchCall(llm, prompt, 'awaited');
        llm.on(
          { endpoint: 'chat', predicate: (req: unknown) => mentions(prompt)(req) && sawRecord(req) },
          { content: ANSWER },
        );

        const { output } = await runLoopScenario({
          engine,
          llm,
          prompt,
          sharedAgent: shared,
          memory: new MockMemory(),
          threadId,
          resourceId: RESOURCE_ID,
          maxSteps: 5,
          streamUntilIdle: true,
          manualStreamConsumption: true,
          fixtures: () => {},
        });
        const drained = collect(output.fullStream as AsyncIterable<unknown>);
        await shared.mastra.backgroundTaskManager.resume(await suspended.taskId, { approved: true });
        const chunks = await drained;
        await suspended.stop();

        expect(answers(chunks)).toBe(1);
        expect(requestsFor(llm.getRequests(), prompt)).toHaveLength(2);
      },
      TEST_TIMEOUT_MS,
    );

    // A deferred task that finishes while a slow tool runs is already in the next request's prompt. (GRWTH-2074)
    it(
      'answers once when a deferred task finishes during the run',
      async () => {
        const prompt = 'Fetch the invoice record and then the slow audit.';
        const threadId = `delivery-${engine}-deferred`;
        const llm = getMock();
        let completed: ReturnType<typeof nextTaskEvent> | undefined;
        const slowAudit = createTool({
          id: 'audit',
          description: 'Audit a record slowly',
          inputSchema: z.object({}),
          execute: async () => {
            // The completion is published after the record's result replaced its placeholder in the
            // conversation, so the next request carries the real result.
            await completed!.taskId;
            return { audit: 'clean' };
          },
        });
        const shared = await createSharedAgent(llm, {
          tools: { 'fetch-record': fetchRecordTool(), audit: slowAudit },
          agentBackgroundTasks: { tools: { 'fetch-record': true } },
          backgroundTasks: BG_CONFIG,
          memory: new MockMemory(),
          engine,
        });
        completed = nextTaskEvent(shared.mastra, threadId, 'background-task-completed');
        scriptFetchCall(llm, prompt, 'deferred');
        llm.on(
          {
            endpoint: 'chat',
            predicate: (req: unknown) => mentions(prompt)(req) && toolContents(req).length === 1 && !sawAudit(req),
          },
          { toolCalls: [{ id: 'call-audit-1', name: 'audit', arguments: {} }] },
        );
        llm.on(
          { endpoint: 'chat', predicate: (req: unknown) => mentions(prompt)(req) && sawAudit(req) },
          { content: ANSWER },
        );

        const { output } = await runLoopScenario({
          engine,
          llm,
          prompt,
          sharedAgent: shared,
          memory: new MockMemory(),
          threadId,
          resourceId: RESOURCE_ID,
          maxSteps: 5,
          streamUntilIdle: true,
          manualStreamConsumption: true,
          fixtures: () => {},
        });
        const chunks = await collect(output.fullStream as AsyncIterable<unknown>);
        await completed.stop();

        const requests = requestsFor(llm.getRequests(), prompt);
        expect(requests).toHaveLength(3);
        expect(answers(chunks)).toBe(1);
        // The answering request already carried the record's real result.
        expect(sawRecord(requests[2]!.body)).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    // The task finishes after the request's prompt was built but before it is sent, so the model
    // answers from the placeholder and only the follow-up request can report the result.
    it(
      'still reports a deferred result that finished while the request was being prepared',
      async () => {
        const prompt = 'Fetch the invoice record in the background.';
        const threadId = `delivery-${engine}-late`;
        const llm = getMock();
        let completed: ReturnType<typeof nextTaskEvent> | undefined;
        // Holds the request that carries the placeholder until the task's result is in the conversation.
        const waitForRecord: Processor = {
          id: 'wait-for-record',
          processLLMRequest: async ({ stepNumber }) => {
            if (stepNumber === 1) await completed!.taskId;
          },
        };
        const shared = await createSharedAgent(llm, {
          tools: { 'fetch-record': fetchRecordTool() },
          agentBackgroundTasks: { tools: { 'fetch-record': true } },
          backgroundTasks: BG_CONFIG,
          memory: new MockMemory(),
          inputProcessors: [waitForRecord],
          engine,
        });
        completed = nextTaskEvent(shared.mastra, threadId, 'background-task-completed');
        scriptFetchCall(llm, prompt, 'deferred');
        llm.on(
          {
            endpoint: 'chat',
            predicate: (req: unknown) => mentions(prompt)(req) && toolContents(req).length === 1 && !sawRecord(req),
          },
          { content: 'Fetching it in the background.' },
        );
        llm.on(
          { endpoint: 'chat', predicate: (req: unknown) => mentions(prompt)(req) && sawRecord(req) },
          { content: ANSWER },
        );

        const { output } = await runLoopScenario({
          engine,
          llm,
          prompt,
          sharedAgent: shared,
          memory: new MockMemory(),
          threadId,
          resourceId: RESOURCE_ID,
          maxSteps: 5,
          streamUntilIdle: true,
          manualStreamConsumption: true,
          fixtures: () => {},
        });
        const chunks = await collect(output.fullStream as AsyncIterable<unknown>);
        await completed.stop();

        const requests = requestsFor(llm.getRequests(), prompt);
        expect(requests.map(r => sawRecord(r.body))).toEqual([false, false, true]);
        expect(answers(chunks)).toBe(1);
      },
      TEST_TIMEOUT_MS,
    );
  },
  // The shared Inngest Mastra is built without per-scenario `backgroundTasks` config.
  { skip: ['inngest'] },
);
