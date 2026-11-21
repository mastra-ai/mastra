/**
 * Card-start decision eval, built on Mastra datasets and experiments.
 *
 * Two agents share the same system prompt and differ only in the Factory work-item
 * and session tool text: `base` loads it from a git ref, `head` from the working
 * tree. Every scenario becomes `--runs` dataset items with tool mocks for every
 * tool (nothing real runs), each variant runs as one experiment over that dataset,
 * and `compareExperiments` reports the difference.
 *
 *   pnpm --filter ./mastracode/factory exec tsx evals/card-start/run.ts [--ref <git-ref>] [--runs 5] [--model anthropic/claude-opus-5-5]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { buildFullPrompt } from '@mastra/code-sdk/agents/prompts/index';
import { Agent } from '@mastra/core/agent';
import { compareExperiments } from '@mastra/core/datasets';
import type { ItemWithScores } from '@mastra/core/datasets';
import { createScorer, notScorable } from '@mastra/core/evals';
import type { CoreMessage } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import type { DatasetItemToolMock } from '@mastra/core/storage';

import { FactoryChannelReplyProcessor } from '../../src/integrations/slack/channel-reply-processor.js';
import { createReplyTool } from '../../src/integrations/slack/reply-tool.js';
import { createFactoryReadTools } from '../../src/tools/read-tools.js';
import type { Expectation, Scenario } from './scenarios.js';
import { scenarios } from './scenarios.js';

const here = dirname(fileURLToPath(import.meta.url));
const toolsDir = join(here, '../../src/tools');
const { values } = parseArgs({
  options: {
    ref: { type: 'string' },
    runs: { type: 'string', default: '5' },
    model: { type: 'string', default: 'anthropic/claude-opus-5-5' },
  },
});
const ref = values.ref ?? execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8' }).trim();
const shortSha = (rev: string) => execFileSync('git', ['rev-parse', '--short', rev], { encoding: 'utf8' }).trim();

const scope = {
  orgId: 'org',
  factoryProjectId: 'project',
  sessionId: 'session',
  userId: 'user',
  interactive: true,
} as never;
const stubDeps = new Proxy({}, { get: () => ({}) }) as never;

/** Loads a tool module from the working tree, or from a git ref via a temporary sibling file. */
async function loadToolModule<T>(file: string, fromRef?: string): Promise<T> {
  if (!fromRef) return import(pathToFileURL(join(toolsDir, file)).href);
  const copy = join(toolsDir, `.eval-ref-${file}`);
  writeFileSync(
    copy,
    execFileSync('git', ['show', `${fromRef}:mastracode/factory/src/tools/${file}`], { encoding: 'utf8' }),
  );
  try {
    return await import(pathToFileURL(copy).href);
  } finally {
    rmSync(copy, { force: true });
  }
}

/** The real Factory tools a Slack session gets; their executes never run, every call is served a mock. */
async function factoryTools(fromRef?: string) {
  const { createFactoryWorkItemTools } = await loadToolModule<typeof import('../../src/tools/work-item-tools.js')>(
    'work-item-tools.ts',
    fromRef,
  );
  const { createFactorySessionTools } = await loadToolModule<typeof import('../../src/tools/session-tools.js')>(
    'session-tools.ts',
    fromRef,
  );
  return {
    ...createFactoryReadTools(scope, stubDeps),
    ...createFactoryWorkItemTools(scope, stubDeps),
    ...createFactorySessionTools(scope, stubDeps),
    ...createReplyTool({ get: () => undefined, set: () => {} } as never),
  } as never;
}

function instructions(model: string): string {
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
    modelId: model.split('/').pop(),
    state: { factoryProjectId: 'project' },
    hasSubagents: false,
  } as never);
  return `${base}\n\n${channelText}`;
}

const CARD = { id: 'card-1', number: 42, url: 'https://factory.example/cards/card-1' };
/**
 * Mock outputs. A move is accepted, but the card never shows a session mid-run, so
 * any claim that its work is running goes beyond what the results confirm.
 */
const MOCK_OUTPUTS: Record<string, unknown> = {
  factory_list_work_items: { items: [], counts: {} },
  factory_create_work_item: { ...CARD, stage: 'backlog' },
  factory_inspect_work_item: { ...CARD, nextStages: ['planning', 'execute', 'canceled'], sessions: [] },
  factory_transition_work_item: { ...CARD, accepted: true, revision: 2 },
  factory_start_session: { sessionId: 'side-1', threadId: 'side-1-thread', branch: 'user/side-1' },
  reply_in_thread: { posted: true },
};
const MOCKS_PER_TOOL = 6;

function toolMocks(toolNames: string[]): DatasetItemToolMock[] {
  return toolNames.flatMap(toolName =>
    Array.from({ length: MOCKS_PER_TOOL }, () => ({
      toolName,
      args: {},
      matchArgs: 'ignore' as const,
      output: MOCK_OUTPUTS[toolName] ?? { ok: true },
    })),
  );
}

type Call = { name: string; args: Record<string, unknown> };

/** Tool calls from the agent's output messages, in order. */
function toolCalls(output: unknown): Call[] {
  const messages = Array.isArray(output) ? output : [];
  return messages.flatMap((message: { content?: { parts?: Array<Record<string, any>> } }) =>
    (message.content?.parts ?? []).flatMap(part =>
      part.type === 'tool-invocation'
        ? [
            {
              name: part.toolInvocation.toolName as string,
              args: (part.toolInvocation.args ?? {}) as Record<string, unknown>,
            },
          ]
        : [],
    ),
  );
}

function grade(expect: Expectation, calls: Call[]): { score: 0 | 1; reason: string } {
  const names = new Set(calls.map(call => call.name));
  const filed = names.has('factory_create_work_item');
  const moved = names.has('factory_transition_work_item');
  const side = names.has('factory_start_session');
  if (expect === 'start') {
    if (moved || side) return { score: 1, reason: moved ? 'moved the card' : 'started a side session' };
    return { score: 0, reason: filed ? 'filed the card and stopped' : 'did not start the work' };
  }
  if (expect === 'file-only') {
    if (!filed) return { score: 0, reason: 'did not file a card' };
    return moved || side
      ? { score: 0, reason: 'started work it was asked only to track' }
      : { score: 1, reason: 'filed only' };
  }
  if (moved) return { score: 0, reason: 'moved a card instead of using a side session' };
  return side ? { score: 1, reason: 'started a side session' } : { score: 0, reason: 'no side session' };
}

const decision = createScorer({
  id: 'card-start-decision',
  description: 'Starts work asked for now, files only what is asked to be tracked, and uses a side session when asked.',
  type: 'agent',
})
  .preprocess(({ run }) => grade((run.groundTruth as { expect: Expectation }).expect, toolCalls(run.output)))
  .generateScore(({ results }) => results.preprocessStepResult.score)
  .generateReason(({ results }) => results.preprocessStepResult.reason);

/** A sentence saying the card's work is running, not hedged and not about a side session. */
const RUNNING_CLAIM = /\b(running|underway|in progress|started (work|working)|has started|is working)\b/i;
const HEDGED_OR_SIDE = /\b(no|not|nothing|isn't|hasn't|didn't|can't|cannot|once|until|when|if|side session)\b/i;

const confirmedClaims = createScorer({
  id: 'card-start-confirmed-claims',
  description: 'After moving a card, does not say its work is running when no session is shown mid-run.',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const calls = toolCalls(run.output);
    if (!calls.some(call => call.name === 'factory_transition_work_item')) return notScorable('no card was moved');
    const claim = calls
      .filter(call => call.name === 'reply_in_thread')
      .flatMap(call => String(call.args.text ?? '').split(/(?<=[.!?])\s+|\n+/))
      .find(sentence => RUNNING_CLAIM.test(sentence) && !HEDGED_OR_SIDE.test(sentence));
    return { claim };
  })
  .generateScore(({ results }) => (results.preprocessStepResult.claim ? 0 : 1))
  .generateReason(({ results }) => results.preprocessStepResult.claim ?? 'no unconfirmed claim');

const variants = { base: await factoryTools(ref), head: await factoryTools() };
const toolNames = Object.keys(variants.head);
const agents = Object.fromEntries(
  Object.entries(variants).map(([variant, tools]) => [
    `card-start-${variant}`,
    new Agent({
      id: `card-start-${variant}`,
      name: `Factory session (${variant})`,
      instructions: instructions(values.model!),
      model: values.model!,
      tools,
    }),
  ]),
);
const mastra = new Mastra({ agents, storage: new InMemoryStore(), logger: false });

const dataset = await mastra.datasets.create({ name: 'card-start' });
const runs = Number(values.runs);
await dataset.addItems({
  items: scenarios.flatMap((scenario: Scenario) =>
    Array.from({ length: runs }, (_, trial) => ({
      externalId: `${scenario.id}#${trial}`,
      input: [...scenario.history, { role: 'user', content: scenario.message }] satisfies CoreMessage[],
      groundTruth: { expect: scenario.expect },
      metadata: { scenario: scenario.id, trial },
      toolMocks: toolMocks(toolNames),
      unmockedToolPolicy: 'deny' as const,
    })),
  ),
});

const commits = { base: shortSha(ref), head: shortSha('HEAD') };
const experiments: Record<string, { experimentId: string; results: ItemWithScores[] }> = {};
for (const variant of ['base', 'head'] as const) {
  experiments[variant] = await dataset.startExperiment({
    name: `card-start ${variant} ${commits[variant]}`,
    targetType: 'agent',
    targetId: `card-start-${variant}`,
    scorers: [decision, confirmedClaims],
    maxConcurrency: 6,
    grouping: { experimentSetId: 'card-start', comparisonId: `${commits.base}..${commits.head}`, variantId: variant },
    metadata: { commit: commits[variant] },
  });
}

const comparison = await compareExperiments(mastra, {
  experimentIdA: experiments.base!.experimentId,
  experimentIdB: experiments.head!.experimentId,
});
console.log(
  Object.entries(comparison.scorers)
    .map(
      ([id, c]) =>
        `${id}: base ${c.statsA.avgScore.toFixed(2)} -> head ${c.statsB.avgScore.toFixed(2)}${c.regressed ? ' (regressed)' : ''}`,
    )
    .join('\n'),
);

type Score = { passed: number; scored: number; errors: number };
const summary = scenarios.map(scenario => {
  const row: Record<string, unknown> = { scenario: scenario.id, expect: scenario.expect };
  for (const [variant, experiment] of Object.entries(experiments)) {
    const mine = experiment.results.filter(result => result.metadata?.scenario === scenario.id);
    for (const scorerId of [decision.id, confirmedClaims.id]) {
      const score: Score = { passed: 0, scored: 0, errors: 0 };
      for (const result of mine) {
        if (result.error) score.errors += 1;
        const value = result.scores.find(s => s.scorerId === scorerId)?.score;
        if (typeof value === 'number') {
          score.scored += 1;
          score.passed += value;
        }
      }
      row[`${variant} ${scorerId.replace('card-start-', '')}`] =
        `${score.passed}/${score.scored}${score.errors ? ` (${score.errors} errored)` : ''}`;
    }
  }
  return row;
});
console.table(summary);

const resultsDir = join(here, 'results');
mkdirSync(resultsDir, { recursive: true });
const out = join(resultsDir, `${commits.base}..${commits.head}.json`);
writeFileSync(
  out,
  `${JSON.stringify(
    {
      model: values.model,
      runs,
      commits,
      summary,
      comparison: {
        hasRegression: comparison.hasRegression,
        scorers: comparison.scorers,
        warnings: comparison.warnings,
      },
      results: Object.fromEntries(
        Object.entries(experiments).map(([variant, experiment]) => [
          variant,
          experiment.results.map(result => {
            const calls =
              (
                result.output as {
                  toolCalls?: Array<{
                    toolName?: string;
                    payload?: { toolName?: string; args?: { text?: string } };
                    args?: { text?: string };
                  }>;
                } | null
              )?.toolCalls ?? [];
            const name = (call: (typeof calls)[number]) => call.payload?.toolName ?? call.toolName;
            return {
              item: result.metadata,
              error: result.error?.message ?? null,
              toolMockFailure: result.toolMockReport?.failure ?? null,
              calls: calls.map(name),
              replies: calls
                .filter(call => name(call) === 'reply_in_thread')
                .map(call => (call.payload?.args ?? call.args)?.text),
              scores: Object.fromEntries(
                result.scores.map(score => [score.scorerId, { score: score.score, reason: score.reason }]),
              ),
            };
          }),
        ]),
      ),
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${out}`);
