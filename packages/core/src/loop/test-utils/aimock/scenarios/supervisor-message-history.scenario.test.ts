import type { ChatCompletionRequest, JournalEntry, LLMock } from '@copilotkit/aimock';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import type { DelegationCompleteContext, MessageFilterContext } from '../../../../agent/agent.types';
import { MockMemory } from '../../../../memory/mock';
import type { OutputProcessor, ProcessOutputResultArgs } from '../../../../processors/index';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../../../request-context';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import type { RunLoopScenarioOptions } from '../types';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * What a sub-agent sees and keeps when a supervisor delegates to it:
 *  - the supervisor's conversation (including earlier turns recalled from memory
 *    and isTaskComplete feedback) is forwarded as context, and messageFilter can
 *    trim it,
 *  - only the delegation prompt and the sub-agent's reply are saved to the
 *    sub-agent's own memory, on a thread separate from the parent's — also when
 *    the parent ids arrive via requestContext reserved keys,
 *  - the sub-agent's own instructions come before instructions the supervisor
 *    model passes in the tool call,
 *  - nested tool calls stay out of the supervisor's model context while the raw
 *    results stay available to onDelegationComplete.
 *
 * Moved from "Message history transfer to sub-agents", "Sub-agent instructions
 * merge" and "Sub-agent context across generate calls" in
 * packages/core/src/agent/__tests__/supervisor-integration.test.ts.
 */

const toolNames = (req: ChatCompletionRequest) => (req.tools ?? []).map(t => t.function?.name);
const isSupervisor = (req: ChatCompletionRequest) => toolNames(req).includes('agent-worker');
const isWorker = (req: ChatCompletionRequest) => !isSupervisor(req);
const lastIsToolResult = (req: ChatCompletionRequest) => req.messages.at(-1)?.role === 'tool';
const mentions = (req: ChatCompletionRequest, text: string) => JSON.stringify(req.messages).includes(text);
const body = (entry: JournalEntry) => entry.body as ChatCompletionRequest;
const workerRequests = (requests: JournalEntry[]) => requests.filter(r => isWorker(body(r)));
const supervisorRequests = (requests: JournalEntry[]) => requests.filter(r => isSupervisor(body(r)));
const systemText = (req: ChatCompletionRequest) =>
  req.messages
    .filter(m => m.role === 'system')
    .map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
    .join('\n');

const THREAD_ID = 'supervisor-history-thread';
const RESOURCE_ID = 'supervisor-history-user';
const CREATE_PROMPT = 'Create a new record named Test Record';
const UPDATE_PROMPT = 'Update the record';
const CREATED_SUMMARY = 'Record rec_12345 was created successfully.';

function makeWorker(
  mock: LLMock,
  extra: {
    memory?: MockMemory;
    instructions?: string;
    tools?: Record<string, ReturnType<typeof createTool>>;
    outputProcessors?: OutputProcessor[];
  } = {},
) {
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
  return new Agent({
    id: 'worker',
    name: 'worker',
    description: 'Manages records',
    instructions: 'You manage records.',
    model: openai(SCENARIO_MODEL_ID),
    ...extra,
  });
}

/** Supervisor delegates `args` on its first request of a run and answers `finalText` once the delegation returns. */
function delegateOnce(llm: LLMock, callId: string, args: Record<string, unknown>, finalText: string) {
  llm.on(
    { endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) },
    { toolCalls: [{ id: callId, name: 'agent-worker', arguments: args }] },
  );
  llm.on({ endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) }, { content: finalText });
}

function resetMock(mock: LLMock) {
  mock.clearRequests();
  mock.clearFixtures();
  mock.resetMatchCounts();
}

describeForAllEngines('AIMock loop scenario: supervisor message history', engine => {
  const getMock = useLoopScenarioAimock();

  const base = (memory: MockMemory) =>
    ({
      engine,
      llm: getMock(),
      memory,
      threadId: THREAD_ID,
      resourceId: RESOURCE_ID,
      stopWhen: stepCountIs(5),
      errorProcessors: [],
    }) satisfies Partial<RunLoopScenarioOptions>;

  /** Two supervisor runs on one thread, each delegating to the worker once. Returns the second run. */
  async function createThenUpdate(worker: Agent) {
    const mock = getMock();
    const memory = new MockMemory();

    await runLoopScenario({
      ...base(memory),
      prompt: CREATE_PROMPT,
      agents: { worker },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: isWorker }, { content: 'Created record with ID rec_12345' });
        delegateOnce(llm, 'call-create', { prompt: 'create record Test Record' }, CREATED_SUMMARY);
      },
    });
    resetMock(mock);

    return runLoopScenario({
      ...base(memory),
      prompt: UPDATE_PROMPT,
      agents: { worker },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: isWorker }, { content: 'Updated record rec_12345' });
        delegateOnce(llm, 'call-update', { prompt: 'update record rec_12345' }, 'Record updated.');
      },
    });
  }

  it('forwards the supervisor conversation from earlier runs to the sub-agent', async () => {
    const { output, requests } = await createThenUpdate(makeWorker(getMock()));

    const [workerRequest] = workerRequests(requests);
    const forwarded = body(workerRequest!).messages.filter(m => m.role !== 'system');
    // The OpenAI Responses provider sends earlier assistant text as an
    // `item_reference`, which AIMock journals as an empty assistant message, so
    // the supervisor's earlier reply is checked by position, not by text.
    expect(forwarded.map(m => [m.role, m.content])).toEqual([
      ['user', CREATE_PROMPT],
      ['assistant', ''],
      ['user', UPDATE_PROMPT],
      ['user', 'update record rec_12345'],
    ]);
    // The supervisor's earlier agent-worker call and its result stay out of the sub-agent's prompt.
    expect(forwarded.filter(m => 'tool_calls' in m && m.tool_calls)).toEqual([]);
    expect(await output.text).toBe('Record updated.');
  });

  it("saves only the delegation prompt and reply to the sub-agent's own memory", async () => {
    const workerMemory = new MockMemory();
    await createThenUpdate(makeWorker(getMock(), { memory: workerMemory }));

    const { threads } = await workerMemory.listThreads({ filter: { resourceId: `${RESOURCE_ID}-worker` } });
    expect(threads.map(t => t.id)).not.toContain(THREAD_ID);
    const saved = await Promise.all(
      threads.map(t => workerMemory.recall({ threadId: t.id, resourceId: `${RESOURCE_ID}-worker` })),
    );
    const updateThread = saved.find(s => JSON.stringify(s.messages).includes('update record rec_12345'));

    expect(updateThread!.messages.map(m => m.role)).toEqual(['user', 'assistant']);
    expect(JSON.stringify(updateThread!.messages[1]!.content)).toContain('Updated record rec_12345');
    expect(JSON.stringify(updateThread!.messages)).not.toContain(CREATE_PROMPT);
    expect(JSON.stringify(updateThread!.messages)).not.toContain(CREATED_SUMMARY);
  });

  it('keeps sub-agent memory on its own thread when parent ids come from requestContext reserved keys', async () => {
    const workerMemory = new MockMemory();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_THREAD_ID_KEY, THREAD_ID);
    requestContext.set(MASTRA_RESOURCE_ID_KEY, RESOURCE_ID);

    await runLoopScenario({
      ...base(new MockMemory()),
      prompt: 'What is my name?',
      requestContext,
      agents: { worker: makeWorker(getMock(), { memory: workerMemory }) },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: isWorker }, { content: 'Sub-agent response' });
        delegateOnce(
          llm,
          'call-1',
          { prompt: 'What is my name?', threadId: THREAD_ID, resourceId: RESOURCE_ID },
          'Done',
        );
      },
    });

    const { threads } = await workerMemory.listThreads({ filter: { resourceId: `${RESOURCE_ID}-worker` } });
    expect(threads).toHaveLength(1);
    expect(threads[0]!.id).not.toBe(THREAD_ID);
    const { messages } = await workerMemory.recall({ threadId: threads[0]!.id, resourceId: `${RESOURCE_ID}-worker` });
    expect(messages.map(m => m.role)).toEqual(['user', 'assistant']);
    expect(requestContext.get(MASTRA_THREAD_ID_KEY)).toBe(THREAD_ID);
    expect(requestContext.get(MASTRA_RESOURCE_ID_KEY)).toBe(RESOURCE_ID);
  });

  it('lets messageFilter drop parent messages before they reach the sub-agent', async () => {
    const mock = getMock();
    const memory = new MockMemory();
    const worker = makeWorker(mock);

    await runLoopScenario({
      ...base(memory),
      prompt: 'SECRET: do not share this',
      agents: { worker },
      fixtures: llm => llm.on({ endpoint: 'chat', predicate: isSupervisor }, { content: 'Noted.' }),
    });
    resetMock(mock);

    const { requests } = await runLoopScenario({
      ...base(memory),
      prompt: 'Do the task please',
      agents: { worker },
      delegation: {
        messageFilter: ({ messages }: MessageFilterContext) =>
          messages.filter(m => !JSON.stringify(m.content).includes('SECRET')),
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: isWorker }, { content: 'Done.' });
        delegateOnce(llm, 'call-1', { prompt: 'do it' }, 'Finished.');
      },
    });

    const [workerRequest] = workerRequests(requests);
    expect(mentions(body(workerRequest!), 'Do the task please')).toBe(true);
    expect(mentions(body(workerRequest!), 'SECRET')).toBe(false);
  });

  // Inngest's agentic loop has no isTaskComplete step yet.
  const itFailsOnInngest = engine === 'inngest' ? it.fails : it;
  itFailsOnInngest('shows isTaskComplete feedback to the supervisor and to the next delegation', async () => {
    let scored = 0;
    const scorer = {
      id: 'fail-then-pass-scorer',
      name: 'fail-then-pass-scorer',
      run: async () =>
        scored++ === 0 ? { score: 0, reason: 'Task not complete yet' } : { score: 1, reason: 'Task is now complete' },
    } as any;
    const isFeedback = (m: ChatCompletionRequest['messages'][number]) =>
      JSON.stringify(m.content).includes('Completion Check Results');
    const toolResults = (req: ChatCompletionRequest) => req.messages.filter(m => m.role === 'tool').length;
    const sawFeedback = (req: ChatCompletionRequest) => req.messages.some(isFeedback);
    const supervisorTurn = (results: number, feedback: boolean) => (req: ChatCompletionRequest) =>
      isSupervisor(req) && toolResults(req) === results && sawFeedback(req) === feedback;

    const { output, requests } = await runLoopScenario({
      ...base(new MockMemory()),
      prompt: 'Complete the task.',
      maxSteps: 10,
      agents: { worker: makeWorker(getMock()) },
      isTaskComplete: { scorers: [scorer] },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: isWorker }, { content: 'Worker output' });
        llm.on(
          { endpoint: 'chat', predicate: supervisorTurn(0, false) },
          { toolCalls: [{ id: 'call-1', name: 'agent-worker', arguments: { prompt: 'Do the task (attempt 1)' } }] },
        );
        llm.on(
          { endpoint: 'chat', predicate: supervisorTurn(1, false) },
          { content: 'Partial progress, will try again.' },
        );
        llm.on(
          { endpoint: 'chat', predicate: supervisorTurn(1, true) },
          { toolCalls: [{ id: 'call-2', name: 'agent-worker', arguments: { prompt: 'Do the task (attempt 2)' } }] },
        );
        llm.on({ endpoint: 'chat', predicate: supervisorTurn(2, true) }, { content: 'All done.' });
      },
    });

    const workers = workerRequests(requests);
    expect(workers).toHaveLength(2);
    expect(mentions(body(workers[0]!), 'Completion Check Results')).toBe(false);
    expect(mentions(body(workers[1]!), 'NOT COMPLETE')).toBe(true);
    const supervisors = supervisorRequests(requests);
    expect(supervisors).toHaveLength(4);
    expect(mentions(body(supervisors[2]!), 'NOT COMPLETE')).toBe(true);
    expect(await output.text).toContain('All done.');

    const last = body(supervisors[3]!).messages;
    expect(last.findIndex(isFeedback)).toBeLessThan(last.findLastIndex(m => m.role === 'tool'));
  });

  it("puts the sub-agent's own instructions before instructions from the supervisor model", async () => {
    const { requests } = await runLoopScenario({
      ...base(new MockMemory()),
      prompt: 'Research TypeScript',
      agents: {
        worker: makeWorker(getMock(), { instructions: 'You are a research assistant. Always cite your sources.' }),
      },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: isWorker }, { content: 'Sub-agent response' });
        delegateOnce(
          llm,
          'call-1',
          { prompt: 'Research TypeScript', instructions: 'Be concise and use bullet points' },
          'Done',
        );
      },
    });

    const system = systemText(body(workerRequests(requests)[0]!));
    const own = system.indexOf('You are a research assistant. Always cite your sources.');
    const fromModel = system.indexOf('Be concise and use bullet points');
    expect(own).toBeGreaterThanOrEqual(0);
    expect(fromModel).toBeGreaterThan(own);
  });

  it("uses only the sub-agent's own instructions when the supervisor model sends none", async () => {
    const { requests } = await runLoopScenario({
      ...base(new MockMemory()),
      prompt: 'Help me',
      agents: { worker: makeWorker(getMock(), { instructions: 'You are a helpful assistant. Be thorough.' }) },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', predicate: isWorker }, { content: 'Sub-agent response' });
        delegateOnce(llm, 'call-1', { prompt: 'Help me' }, 'Done');
      },
    });

    // The supervisor's own system prompt is forwarded later as conversation context; the
    // sub-agent's instructions must still be the first system message, with nothing merged in.
    const systemMessages = body(workerRequests(requests)[0]!).messages.filter(m => m.role === 'system');
    expect(systemMessages[0]?.content).toBe('You are a helpful assistant. Be thorough.');
  });

  it("keeps nested tool calls out of the supervisor's context but reports them to onDelegationComplete", async () => {
    const processedText = 'Processed summary without nested tool details.';
    const rewriteText: OutputProcessor = {
      id: 'rewrite-text',
      async processOutputResult({ messages }: ProcessOutputResultArgs) {
        return messages.map(msg =>
          msg.role !== 'assistant'
            ? msg
            : {
                ...msg,
                content: {
                  ...msg.content,
                  parts: msg.content.parts.map(p => (p.type === 'text' ? { ...p, text: processedText } : p)),
                },
              },
        );
      },
    };
    const lookupSecret = createTool({
      id: 'lookup-secret',
      description: 'Looks up private data',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => ({ query, secret: 'SECRET_NESTED_TOOL_RESULT' }),
    });
    const completions: DelegationCompleteContext[] = [];

    const { requests } = await runLoopScenario({
      ...base(new MockMemory()),
      prompt: 'Delegate this task',
      agents: {
        worker: makeWorker(getMock(), { tools: { lookupSecret }, outputProcessors: [rewriteText] }),
      },
      delegation: { onDelegationComplete: (ctx: DelegationCompleteContext) => void completions.push(ctx) },
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', predicate: req => isWorker(req) && !lastIsToolResult(req) },
          {
            toolCalls: [{ id: 'call-nested', name: 'lookupSecret', arguments: { query: 'SECRET_NESTED_TOOL_ARG' } }],
          },
        );
        llm.on(
          { endpoint: 'chat', predicate: req => isWorker(req) && lastIsToolResult(req) },
          { content: 'Task completed.' },
        );
        delegateOnce(llm, 'call-1', { prompt: 'Research the private record' }, 'Done');
      },
    });

    const delegationResult = JSON.stringify(body(supervisorRequests(requests)[1]!).messages.at(-1));
    expect(delegationResult).toContain(processedText);
    expect(delegationResult).not.toContain('Task completed.');
    expect(delegationResult).not.toContain('SECRET_NESTED_TOOL_ARG');
    expect(delegationResult).not.toContain('SECRET_NESTED_TOOL_RESULT');
    expect(completions[0]!.result.subAgentToolResults).toEqual([
      expect.objectContaining({
        toolName: 'lookupSecret',
        args: { query: 'SECRET_NESTED_TOOL_ARG' },
        result: expect.objectContaining({ secret: 'SECRET_NESTED_TOOL_RESULT' }),
      }),
    ]);
  });
});
