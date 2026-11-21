/**
 * Replays the synthetic decisions in ./scenarios.ts against the real Factory
 * tool descriptions, with stubbed tool results, and grades each turn.
 *
 *   pnpm --filter ./mastracode/factory exec tsx evals/card-start/run.ts [--ref <git-ref>] [--runs 3] [--model anthropic/claude-opus-5-5]
 *
 * `--ref` reads the work-item and session tool sources from that commit instead
 * of the working tree, to compare a change against its base.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { buildFullPrompt } from '@mastra/code-sdk/agents/prompts/index';
import { Agent } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core/llm';
import { createTool } from '@mastra/core/tools';

import { FactoryChannelReplyProcessor } from '../../src/integrations/slack/channel-reply-processor.js';
import { createReplyTool } from '../../src/integrations/slack/reply-tool.js';
import { createFactoryReadTools } from '../../src/tools/read-tools.js';
import type { Expectation } from './scenarios.js';
import { scenarios } from './scenarios.js';

const here = dirname(fileURLToPath(import.meta.url));
const toolsDir = join(here, '../../src/tools');
const { values } = parseArgs({
  options: {
    ref: { type: 'string' },
    runs: { type: 'string', default: '3' },
    model: { type: 'string', default: 'anthropic/claude-opus-5-5' },
    only: { type: 'string' },
  },
});

const scope = {
  orgId: 'org',
  factoryProjectId: 'project',
  sessionId: 'session',
  userId: 'user',
  interactive: true,
} as never;
const stubDeps = new Proxy({}, { get: () => ({}) }) as never;

/** Loads a tool module from the working tree, or from `ref` via a temporary sibling file. */
async function loadToolModule<T>(file: string): Promise<T> {
  if (!values.ref) return import(pathToFileURL(join(toolsDir, file)).href);
  const copy = join(toolsDir, `.eval-ref-${file}`);
  const source = execFileSync('git', ['show', `${values.ref}:mastracode/factory/src/tools/${file}`], {
    encoding: 'utf8',
  });
  writeFileSync(copy, source);
  try {
    return await import(pathToFileURL(copy).href);
  } finally {
    rmSync(copy, { force: true });
  }
}

const CARD_URL = 'https://factory.example/cards/card-1';
/** Stub results. A move is accepted and the card shows its new stage, but no session is ever mid-run on it. */
function stubResult(id: string, input: Record<string, unknown>, card: { stage: string }): unknown {
  switch (id) {
    case 'factory_list_work_items':
      return { items: [], counts: {} };
    case 'factory_create_work_item':
      return { id: 'card-1', number: 42, url: CARD_URL, title: input.title, stage: card.stage };
    case 'factory_inspect_work_item':
      return {
        id: 'card-1',
        number: 42,
        url: CARD_URL,
        stage: card.stage,
        nextStages: ['planning', 'execute', 'canceled'],
        sessions: [],
      };
    case 'factory_transition_work_item':
      card.stage = String(input.stage);
      return { id: 'card-1', url: CARD_URL, stage: card.stage, revision: 2 };
    case 'factory_start_session':
      return { sessionId: 'side-1', threadId: 'side-1-thread', branch: 'user/side-1' };
    case 'reply_in_thread':
      return { posted: true };
    default:
      return { ok: true };
  }
}

type Call = { name: string; input: Record<string, unknown> };

async function buildTools(calls: Call[]) {
  const card = { stage: 'backlog' };
  const { createFactoryWorkItemTools } =
    await loadToolModule<typeof import('../../src/tools/work-item-tools.js')>('work-item-tools.ts');
  const { createFactorySessionTools } =
    await loadToolModule<typeof import('../../src/tools/session-tools.js')>('session-tools.ts');
  const real: Record<string, unknown> = {
    ...createFactoryReadTools(scope, stubDeps),
    ...createFactoryWorkItemTools(scope, stubDeps),
    ...createFactorySessionTools(scope, stubDeps),
    ...createReplyTool({ get: () => undefined, set: () => {} } as never),
  };
  return Object.fromEntries(
    Object.entries(real as Record<string, { description?: string; inputSchema?: unknown } | undefined>).flatMap(
      ([id, tool]) =>
        tool
          ? [
              [
                id,
                createTool({
                  id,
                  description: tool.description ?? '',
                  inputSchema: tool.inputSchema as never,
                  execute: async (input: Record<string, unknown>) => {
                    calls.push({ name: id, input });
                    return stubResult(id, input, card);
                  },
                }),
              ],
            ]
          : [],
    ),
  );
}

function systemPrompt(modelId: string): string {
  let channelText = '';
  new FactoryChannelReplyProcessor().processInputStep({
    messageList: { addSystem: (message: { content: string }) => (channelText = message.content) },
    requestContext: { get: (key: string) => (key === 'channel' ? {} : undefined) },
    tools: { reply_in_thread: {} },
  } as never);
  const base = buildFullPrompt({
    modeId: 'build',
    workingDir: '/workspace',
    projectName: 'acme',
    currentDate: '2026-11-21',
    modelId,
    state: { factoryProjectId: 'project' },
    hasSubagents: false,
  } as never);
  return `${base}\n\n${channelText}`;
}

const STARTS = new Set(['factory_transition_work_item', 'factory_start_session']);
/**
 * A sentence saying the card's work is running. The stubs never confirm a run (inspect shows no
 * session mid-run), so after a card move this is a claim beyond what the result proved.
 */
const RUNNING_CLAIM = /\b(running|underway|in progress|started (work|working)|has started|is working)\b/i;
const HEDGED_OR_SIDE = /\b(no|not|nothing|isn't|hasn't|didn't|can't|cannot|once|until|when|if|side session)\b/i;

function claimsCardRunning(calls: Call[], replies: string[]): boolean {
  if (!calls.some(call => call.name === 'factory_transition_work_item')) return false;
  return replies
    .flatMap(reply => reply.split(/(?<=[.!?])\s+|\n+/))
    .some(sentence => RUNNING_CLAIM.test(sentence) && !HEDGED_OR_SIDE.test(sentence));
}

function grade(expect: Expectation, calls: Call[]): { pass: boolean; why: string } {
  const names = calls.map(call => call.name);
  const filed = names.includes('factory_create_work_item');
  const moved = names.includes('factory_transition_work_item');
  const side = names.includes('factory_start_session');
  if (expect === 'start') {
    return names.some(name => STARTS.has(name))
      ? { pass: true, why: moved ? 'moved the card' : 'started a side session' }
      : { pass: false, why: filed ? 'filed the card and stopped' : 'did not start the work' };
  }
  if (expect === 'file-only') {
    if (!filed) return { pass: false, why: 'did not file a card' };
    return moved || side
      ? { pass: false, why: 'started work it was asked only to track' }
      : { pass: true, why: 'filed only' };
  }
  if (moved) return { pass: false, why: 'moved a card instead of using a side session' };
  return side ? { pass: true, why: 'started a side session' } : { pass: false, why: 'no side session' };
}

const label = values.ref ? `ref ${values.ref}` : 'working tree';
const runs = Number(values.runs);
const selected = values.only ? scenarios.filter(s => values.only!.split(',').includes(s.id)) : scenarios;
const rows: Array<Record<string, unknown>> = [];
for (const scenario of selected) {
  await Promise.all(
    Array.from({ length: runs }, async (_, run) => {
      const calls: Call[] = [];
      const agent = new Agent({
        id: 'card-start-eval',
        name: 'Factory session',
        instructions: systemPrompt(values.model!.split('/').pop()!),
        model: values.model!,
        tools: await buildTools(calls),
      });
      try {
        const messages: CoreMessage[] = [...scenario.history, { role: 'user', content: scenario.message }];
        await agent.generate(messages, { maxSteps: 8 });
      } catch (error) {
        rows.push({ scenario: scenario.id, run, error: (error as Error).message });
        return;
      }
      const replies = calls.filter(call => call.name === 'reply_in_thread').map(call => String(call.input.text ?? ''));
      const { pass, why } = grade(scenario.expect, calls);
      rows.push({
        scenario: scenario.id,
        expect: scenario.expect,
        run,
        pass,
        why,
        claimsCardRunning: claimsCardRunning(calls, replies),
        calls: calls.map(call => call.name),
        replies,
      });
      console.log(`${scenario.id.padEnd(28)} ${pass ? 'pass' : 'FAIL'}  ${why}`);
    }),
  );
}

const summary = selected.map(scenario => {
  const mine = rows.filter(row => row.scenario === scenario.id && !row.error);
  return {
    scenario: scenario.id,
    expect: scenario.expect,
    passed: mine.filter(row => row.pass).length,
    runs: mine.length,
    claimsCardRunning: mine.filter(row => row.claimsCardRunning).length,
  };
});
console.table(summary);
const resultsDir = join(here, 'results');
mkdirSync(resultsDir, { recursive: true });
const commit = execFileSync('git', ['rev-parse', '--short', values.ref ?? 'HEAD'], { encoding: 'utf8' }).trim();
const out = join(resultsDir, `${values.ref ? 'base' : 'head'}-${commit}.json`);
writeFileSync(out, `${JSON.stringify({ label, commit, model: values.model, runs, summary, rows }, null, 2)}\n`);
console.log(`wrote ${out}`);
