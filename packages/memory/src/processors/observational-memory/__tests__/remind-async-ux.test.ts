import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterEach, expect, it, vi } from 'vitest';

import { createRemindWaitTool } from '../subconscious/remind';
import { ReminderResearchBudgetProcessor } from '../subconscious/remind-budget';
import { RemindRequestRegistry } from '../subconscious/remind-request-state';

const subconsciousDir = fileURLToPath(new URL('../subconscious/', import.meta.url));
const remindSource = readFileSync(`${subconsciousDir}/remind.ts`, 'utf8');
const requestStateSource = readFileSync(`${subconsciousDir}/remind-request-state.ts`, 'utf8');
const budgetPath = `${subconsciousDir}/remind-budget.ts`;
const budgetSource = existsSync(budgetPath) ? readFileSync(budgetPath, 'utf8') : '';

function expectUx(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

it('async UX: reply schema exposes explicit more_coming partial state', () => {
  expectUx(
    /more_coming|moreComing/.test(remindSource) && /partial/.test(remindSource),
    'missing partial protocol: reply_to_memory_question has no explicit more_coming partial schema',
  );
});

it('async UX: lifecycle atomically reserves partial delivery before returning to pending', () => {
  expectUx(
    requestStateSource.includes('partial_sending') && requestStateSource.includes('reservePartial'),
    'missing partial protocol: lifecycle has no atomic partial_sending reservation',
  );
});

it('async UX: partial replies use deterministic monotonically sequenced signal ids', () => {
  expectUx(
    requestStateSource.includes('`remind-answer:${correlationId}:partial:${sequence}`'),
    'missing partial protocol: deterministic partial sequence signal identity is absent',
  );
});

it('async UX: partials persist without waking and terminal replies wake after them', () => {
  expectUx(
    /partial[\s\S]*behavior:\s*'persist'/.test(remindSource) && /terminal[\s\S]*behavior:\s*'wake'/.test(remindSource),
    'missing partial protocol: persisted partial-before-terminal wake ordering is absent',
  );
});

const conversation = { remindThreadId: 'remind:alpha', resourceId: 'remind-resource' };
let budgetRegistry: RemindRequestRegistry | undefined;

afterEach(() => {
  budgetRegistry?.dispose();
  budgetRegistry = undefined;
  vi.useRealTimers();
});

function budgetFixture() {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const registry = new RemindRequestRegistry();
  budgetRegistry = registry;
  registry.create({
    correlationId: 'remind-ask-oldest',
    conversation,
    sourceAgentId: 'main',
    sourceThreadId: 'alpha',
    sourceResourceId: 'user-42',
    now: 0,
  });
  const processor = new ReminderResearchBudgetProcessor(registry, conversation);
  const state: Record<string, unknown> = {};
  const messages = [{ metadata: { kind: 'remind-ask', correlationId: 'remind-ask-oldest' } }];
  const inputArgs = { state, messages } as any;
  const requestArgs = { state, prompt: [], stepNumber: 0, steps: [] } as any;
  return { registry, processor, state, messages, inputArgs, requestArgs };
}

it('async UX: reminder Agent installs a question-aware research budget processor', () => {
  expectUx(
    budgetSource.length > 0 && /ReminderResearchBudgetProcessor/.test(remindSource),
    'missing research budget: no question-aware budget processor is installed',
  );
});

it('async UX: research budget nudges are transient and never persisted', () => {
  const { processor, messages, inputArgs, requestArgs } = budgetFixture();
  vi.setSystemTime(20_000);

  processor.processInputStep(inputArgs);
  const result = processor.processLLMRequest(requestArgs);

  expect(messages).toEqual([{ metadata: { kind: 'remind-ask', correlationId: 'remind-ask-oldest' } }]);
  expect(result?.prompt).toEqual([
    expect.objectContaining({ role: 'system', content: expect.stringContaining('more_coming=true') }),
  ]);
  expectUx(/transient:\s*true/.test(budgetSource), 'missing research budget: budget nudges are not transient');
});

it('async UX: research budget escalates at twenty-second intervals', () => {
  const { registry, processor, state, messages, inputArgs, requestArgs } = budgetFixture();

  const levels: string[] = [];
  for (const elapsed of [20_000, 40_000, 60_000]) {
    vi.setSystemTime(elapsed);
    processor.processInputStep(inputArgs);
    const result = processor.processLLMRequest(requestArgs);
    levels.push((result?.prompt?.at(-1)?.content as string) ?? '');
  }

  expect(levels[0]).toContain('partial delta');
  expect(levels[1]).toContain('Synthesize');
  expect(levels[2]).toContain('final delta');

  processor.processInputStep(inputArgs);
  expect(processor.processLLMRequest(requestArgs)).toBeUndefined();

  registry.fail('remind-ask-oldest', 'aborted', 'cancelled');
  const younger = registry.create({
    correlationId: 'remind-ask-younger',
    conversation,
    sourceAgentId: 'main',
    sourceThreadId: 'alpha',
    sourceResourceId: 'user-42',
    now: 60_000,
  });
  vi.setSystemTime(80_000);
  processor.processInputStep({
    ...inputArgs,
    messages: [...messages, { metadata: { kind: 'remind-ask', correlationId: younger.correlationId } }],
  });
  expect(processor.processLLMRequest({ ...requestArgs, state })?.prompt?.at(-1)?.content).toContain('partial delta');
});

it('async UX: checkpoint returns at most twelve sanitized activity records without answer payloads', () => {
  expectUx(
    /recentActivity|toolActivity/.test(requestStateSource) &&
      /slice\(-12\)|maxActivityEntries/.test(requestStateSource),
    'missing wait checkpoint: lifecycle exposes no bounded sanitized recent activity projection',
  );
  expect(requestStateSource).not.toMatch(/^\s*answer\??\s*:/m);
});

const checkpointSource = { agentId: 'main', threadId: 'alpha', resourceId: 'user-42' };

function checkpointFixture() {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const registry = new RemindRequestRegistry();
  budgetRegistry = registry;
  const create = (correlationId: string) =>
    registry.create({
      correlationId,
      conversation,
      sourceAgentId: checkpointSource.agentId,
      sourceThreadId: checkpointSource.threadId,
      sourceResourceId: checkpointSource.resourceId,
      now: 0,
    });
  const tool = createRemindWaitTool(registry);
  const context = { agent: checkpointSource } as any;
  const wait = (correlationIds: string[], timeoutMs = 0, contextOverride = context) =>
    tool.execute!({ correlationIds, timeoutMs } as any, contextOverride);
  return { registry, create, wait, context };
}

it('wait checkpoint: returns a pending request as checkpoint-only timeout after fifteen seconds', async () => {
  const { create, wait } = checkpointFixture();
  create('remind-ask-pending');

  const result = wait(['remind-ask-pending'], 15_000);
  await vi.advanceTimersByTimeAsync(15_000);

  await expect(result).resolves.toMatchObject({
    ok: true,
    outstanding: true,
    outstandingCorrelationIds: ['remind-ask-pending'],
    requests: [{ correlationId: 'remind-ask-pending', status: 'timeout' }],
  });
});

it('wait checkpoint: returns immediately when a request is terminal', async () => {
  const { registry, create, wait } = checkpointFixture();
  create('remind-ask-complete');
  registry.reserveTerminal('remind-ask-complete', conversation);
  registry.markReplied('remind-ask-complete');

  await expect(wait(['remind-ask-complete'], 15_000)).resolves.toMatchObject({
    outstanding: false,
    outstandingCorrelationIds: [],
    requests: [{ correlationId: 'remind-ask-complete', status: 'completed' }],
  });
});

it('wait checkpoint: supports repeated pending then terminal checkpoints', async () => {
  const { registry, create, wait } = checkpointFixture();
  create('remind-ask-repeat');

  await expect(wait(['remind-ask-repeat'])).resolves.toMatchObject({
    requests: [{ status: 'timeout' }],
  });
  registry.reserveTerminal('remind-ask-repeat', conversation);
  registry.markReplied('remind-ask-repeat');
  await expect(wait(['remind-ask-repeat'])).resolves.toMatchObject({
    requests: [{ status: 'completed' }],
  });
});

it('wait checkpoint: exposes aborted lifecycle state without fabricating an answer', async () => {
  const { registry, create, wait } = checkpointFixture();
  create('remind-ask-aborted');
  registry.fail('remind-ask-aborted', 'aborted', 'caller cancelled');

  await expect(wait(['remind-ask-aborted'])).resolves.toMatchObject({
    requests: [{ correlationId: 'remind-ask-aborted', status: 'aborted' }],
  });
});

it('wait checkpoint: classifies unavailable correlations as unknown', async () => {
  const { wait } = checkpointFixture();

  await expect(wait(['remind-ask-missing'])).resolves.toMatchObject({
    outstanding: false,
    outstandingCorrelationIds: [],
    requests: [{ correlationId: 'remind-ask-missing', status: 'unknown', recentActivity: [] }],
  });
});

it('wait checkpoint: preserves independent mixed correlation outcomes', async () => {
  const { registry, create, wait } = checkpointFixture();
  create('remind-ask-pending');
  create('remind-ask-complete');
  create('remind-ask-failed');
  registry.reserveTerminal('remind-ask-complete', conversation);
  registry.markReplied('remind-ask-complete');
  registry.fail('remind-ask-failed', 'model_failed', 'provider failed');

  await expect(
    wait(['remind-ask-pending', 'remind-ask-complete', 'remind-ask-failed', 'remind-ask-unknown']),
  ).resolves.toMatchObject({
    outstanding: true,
    outstandingCorrelationIds: ['remind-ask-pending'],
    requests: [
      { correlationId: 'remind-ask-pending', status: 'timeout' },
      { correlationId: 'remind-ask-complete', status: 'completed' },
      { correlationId: 'remind-ask-failed', status: 'failed' },
      { correlationId: 'remind-ask-unknown', status: 'unknown' },
    ],
  });
});

it('wait checkpoint: truncates sanitized activity to the latest twelve records in order', async () => {
  const { registry, create, wait } = checkpointFixture();
  create('remind-ask-activity');
  for (let index = 0; index < 14; index += 1) {
    registry.recordActivity('remind-ask-activity', {
      timestamp: index,
      toolName: `tool-${index}`,
      action: 'execute',
      status: 'completed',
    });
  }

  const result = (await wait(['remind-ask-activity'])) as any;
  expect(result.requests[0].recentActivity).toHaveLength(12);
  expect(result.requests[0].recentActivity.map((entry: any) => entry.toolName)).toEqual(
    Array.from({ length: 12 }, (_, index) => `tool-${index + 2}`),
  );
});

it('wait checkpoint: excludes answer bodies and tool arguments from its read model', async () => {
  const { registry, create, wait } = checkpointFixture();
  create('remind-ask-sanitized');
  registry.recordActivity('remind-ask-sanitized', {
    toolName: 'knowledge_search',
    action: 'execute',
    status: 'completed',
  });

  const result = (await wait(['remind-ask-sanitized'])) as any;
  const activity = result.requests[0].recentActivity[0];
  expect(activity).toEqual({
    toolName: 'knowledge_search',
    action: 'execute',
    status: 'completed',
    timestamp: 0,
  });
  expect(activity).not.toHaveProperty('answer');
  expect(activity).not.toHaveProperty('arguments');
  expect(JSON.stringify(activity)).not.toContain('secret query');
});
