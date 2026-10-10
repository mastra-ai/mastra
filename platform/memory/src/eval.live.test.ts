import { readFileSync, writeFileSync } from 'node:fs';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { Agent as PiAgent } from '@earendil-works/pi-agent-core';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { Type } from '@earendil-works/pi-ai';
import { getModel, streamSimple } from '@earendil-works/pi-ai/compat';
import { tool as lcTool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { Agent } from '@mastra/core/agent';
import type { MastraMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { generateText, Output, stepCountIs, tool, wrapLanguageModel } from 'ai';
import { createDeepAgent } from 'deepagents';
import { createAgent } from 'langchain';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { platformMemoryMiddleware } from './ai-sdk';
import { PlatformMemoryClient } from './client';
import { SCENARIOS } from './eval-scenarios';
import type { Ability, Question, Scenario } from './eval-scenarios';
import { platformMemoryAgentMiddleware } from './langgraph';
import { withPlatformMemory } from './pi-agent';
import { PlatformMemory } from './platform-memory';

/**
 * Real-model memory quality eval, modelled on BEAM. Realistic single-thread scenarios are played
 * through every framework adapter with a real agent model and the real observer/reflector. Each
 * quiz question is then answered on its own clone of the thread, so answers can't leak into one
 * another, and graded per rubric nugget (0 / 0.5 / 1) by a separate judge model. The judge is first
 * checked against each question's reference answer. Results land in /tmp/memory-eval.json with
 * per-ability accuracy, run-to-run spread, 95% bootstrap CIs and the delta against OSS Memory.
 *
 * Needs: OPENAI_API_KEY, PLATFORM_MEMORY_EVAL=<path to { instanceId, token }>, a local Platform API
 * on :3010 started with MEMORY_TEST_MODEL_URL=https://api.openai.com/v1 and MEMORY_TEST_MODEL_KEY, and
 * the instance configured with model openai/gpt-4.1-mini and the thresholds below.
 */
const evalFile = process.env.PLATFORM_MEMORY_EVAL;
const API = 'http://127.0.0.1:3010';
const MODEL = 'gpt-4.1-mini';
// Grader is a different, stronger model than the answerer so it doesn't share its blind spots.
const JUDGE_MODEL = process.env.PLATFORM_MEMORY_EVAL_JUDGE ?? 'gpt-4.1';
// Optional judge from another provider; the report shows how often the two agree.
const SECOND_JUDGE = process.env.PLATFORM_MEMORY_EVAL_SECOND_JUDGE;
export const OBSERVATION_TOKENS = 1500;
export const REFLECTION_TOKENS = 4000;

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const creds = () => JSON.parse(readFileSync(evalFile!, 'utf8')) as { instanceId: string; token: string };
const client = () =>
  new PlatformMemoryClient({ apiUrl: API, accessToken: creds().token, instanceId: creds().instanceId });

type Runner = {
  ask(text: string): Promise<string>;
  settle(): Promise<void>;
  observations(): Promise<string>;
  /** Unobserved messages the server would send next turn; Platform-backed runners only. */
  rawTail?(): Promise<string>;
  /** Runner on a copy of this thread. Platform-backed runners are forked via the API instead. */
  fork?(newThreadId: string): Promise<Runner>;
};

function mastraRunner(
  s: Scenario,
  memory: MastraMemory,
  threadId: string,
  settle: () => Promise<void>,
  obs: () => Promise<string>,
): Runner {
  const agent = new Agent({
    id: 'eval',
    name: 'eval',
    instructions: s.system,
    model: openai(MODEL),
    memory,
    tools: {
      search: createTool({
        id: 'search',
        description: s.toolDescription,
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => s.search(query),
      }),
    },
  });
  return {
    ask: async text =>
      (await agent.generate(text, { memory: { thread: threadId, resource: 'user' }, maxSteps: 8 })).text,
    settle,
    observations: obs,
  };
}

function platformSide(threadId: string) {
  const c = client();
  return {
    c,
    settle: async () => {
      await c.observe(threadId);
    },
    observations: async () => (await c.getObservations(threadId))?.activeObservations ?? '',
    rawTail: async () => JSON.stringify((await c.getContext(threadId, 'user', { workingMemory: 'off' })).messages),
  };
}

const RUNNERS: Record<string, (threadId: string, s: Scenario) => Runner> = {
  'OSS Memory': (threadId, s) => {
    const store = new InMemoryStore();
    const memory = new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          model: `openai/${MODEL}`,
          observation: { messageTokens: OBSERVATION_TOKENS, bufferTokens: false },
          reflection: { observationTokens: REFLECTION_TOKENS },
        },
      },
    });
    const on = (id: string): Runner => ({
      ...mastraRunner(
        s,
        memory,
        id,
        async () => {},
        async () =>
          (await (await store.getStore('memory'))!.getObservationalMemory(id, 'user'))?.activeObservations ?? '',
      ),
      fork: async newThreadId => {
        await memory.cloneThread({ sourceThreadId: id, newThreadId });
        return on(newThreadId);
      },
    });
    return on(threadId);
  },
  PlatformMemory: (threadId, s) => {
    const p = platformSide(threadId);
    const runner = mastraRunner(
      s,
      new PlatformMemory({ client: p.c, workingMemory: 'off' }),
      threadId,
      p.settle,
      p.observations,
    );
    return { ...runner, rawTail: p.rawTail };
  },
  'AI SDK': (threadId, s) => {
    const p = platformSide(threadId);
    const model = wrapLanguageModel({
      model: openai(MODEL),
      middleware: platformMemoryMiddleware({ client: p.c, threadId, resourceId: 'user' }),
    });
    const tools = {
      search: tool({
        description: s.toolDescription,
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => s.search(query),
      }),
    };
    return {
      ask: async prompt =>
        (await generateText({ model, system: s.system, prompt, tools, stopWhen: stepCountIs(8) })).text,
      ...p,
    };
  },
  ...Object.fromEntries(
    (['LangGraph', 'Deep Agents'] as const).map(name => [
      name,
      (threadId: string, s: Scenario): Runner => {
        const p = platformSide(threadId);
        const search = lcTool(async ({ query }: { query: string }) => s.search(query), {
          name: 'search',
          description: s.toolDescription,
          schema: z.object({ query: z.string() }),
        });
        const opts = {
          model: new ChatOpenAI({ model: MODEL }),
          tools: [search],
          middleware: [platformMemoryAgentMiddleware({ client: p.c, resourceId: 'user' })],
        };
        const agent =
          name === 'LangGraph'
            ? createAgent({ ...opts, systemPrompt: s.system })
            : createDeepAgent({ ...opts, systemPrompt: s.system });
        return {
          ask: async text => {
            // Only the new message goes in: memory carries the thread, like a stateless API handler.
            const out = await agent.invoke(
              { messages: [{ role: 'user', content: text }] },
              { configurable: { thread_id: threadId }, recursionLimit: 30 },
            );
            const last = out.messages.at(-1)!;
            return typeof last.content === 'string' ? last.content : JSON.stringify(last.content);
          },
          ...p,
        };
      },
    ]),
  ),
  'pi agent': (threadId, s) => {
    const p = platformSide(threadId);
    const search: AgentTool = {
      name: 'search',
      label: 'search',
      description: s.toolDescription,
      parameters: Type.Object({ query: Type.String() }),
      execute: async (_id, args) => ({
        content: [{ type: 'text', text: s.search((args as { query: string }).query) }],
        details: {},
      }),
    };
    const agent = new PiAgent({
      streamFn: streamSimple as never,
      initialState: { systemPrompt: s.system, model: getModel('openai', MODEL as never), tools: [search] },
      getApiKey: () => process.env.OPENAI_API_KEY,
    });
    withPlatformMemory(agent, { client: p.c, threadId, resourceId: 'user' });
    return {
      ask: async text => {
        await agent.prompt(text);
        const last = agent.state.messages.at(-1) as { content?: { type: string; text?: string }[] };
        return (last.content ?? []).flatMap(c => (c.type === 'text' ? [c.text] : [])).join('');
      },
      ...p,
    };
  },
};

const NUGGET = { 0: 0, 0.5: 0.5, 1: 1 } as const;

/** Scores each rubric nugget 0 (missing/wrong), 0.5 (partly) or 1 (fully); the question scores their mean. */
async function judge(q: string, rubric: string[], answer: string, model = openai(JUDGE_MODEL)) {
  const { output } = await generateText({
    model,
    temperature: 0,
    output: Output.object({
      schema: z.object({
        nuggets: z.array(
          z.object({ reason: z.string(), score: z.union([z.literal(0), z.literal(0.5), z.literal(1)]) }),
        ),
      }),
    }),
    system:
      'You grade answers from an assistant that should remember an earlier conversation. For each numbered rubric item, return one entry in order: 1 if the answer fully satisfies it, 0.5 if partly, 0 if missing or contradicted. Judge by meaning, not wording. Extra correct detail is fine.',
    prompt: `Question: ${q}\nRubric:\n${rubric.map((r, i) => `${i + 1}. ${r}`).join('\n')}\nAnswer: ${answer}`,
  });
  const nuggets = rubric.map((_, i) => NUGGET[output.nuggets[i]?.score ?? 0]);
  return {
    score: nuggets.reduce((a, b) => a + b, 0) / nuggets.length,
    reason: output.nuggets.map(n => n.reason).join(' | '),
  };
}

const only = process.env.PLATFORM_MEMORY_EVAL_ONLY?.split(',');
const scenarios = process.env.PLATFORM_MEMORY_EVAL_SCENARIOS?.split(',');
const RUNS = Number(process.env.PLATFORM_MEMORY_EVAL_RUNS ?? 1);
type Graded = { q: string; ability: Ability; answer: string; score: number; reason: string; second?: number };
const results: {
  scenario: string;
  framework: string;
  run: number;
  score: number;
  of: number;
  compressed: boolean | null;
  observations: string;
  graded: Graded[];
}[] = [];
const judgeCheck: { scenario: string; q: string; score: number; reason: string }[] = [];
const BASELINE = 'OSS Memory';

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
function stats(xs: number[]) {
  const m = mean(xs);
  return { mean: m, sd: Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)) };
}
/** 95% percentile bootstrap CI over per-question scores. */
function ci(xs: number[]) {
  const means = Array.from({ length: 2000 }, () => mean(xs.map(() => xs[Math.floor(Math.random() * xs.length)]!)));
  means.sort((a, b) => a - b);
  return [means[50]!, means[1949]!] as const;
}
const p = (x: number) => (x * 100).toFixed(0);

function summarize() {
  const frameworks = [...new Set(results.map(r => r.framework))];
  const byScenario: Record<string, Record<string, string>> = {};
  const byAbility: Record<string, Record<string, string>> = {};
  const overall: Record<
    string,
    { accuracy: string; ci95: string; sdAcrossRuns: number; vsBaseline: string; n: number }
  > = {};
  const acc: Record<string, number> = {};
  const sds: Record<string, number> = {};
  for (const f of frameworks) {
    const mine = results.filter(r => r.framework === f);
    for (const s of new Set(mine.map(r => r.scenario))) {
      const runs = mine.filter(r => r.scenario === s);
      const st = stats(runs.map(r => r.score / r.of));
      (byScenario[f] ??= {})[s] = `${p(st.mean)}% ±${p(st.sd)} (n=${runs.length})`;
    }
    const all = mine.flatMap(r => r.graded);
    for (const a of new Set(all.map(g => g.ability))) {
      const xs = all.filter(g => g.ability === a).map(g => g.score);
      (byAbility[f] ??= {})[a] = `${p(mean(xs))}% (n=${xs.length})`;
    }
    // Per-run accuracy across every scenario, so sd reflects run-to-run noise.
    const runAcc = [...new Set(mine.map(r => r.run))].map(run =>
      mean(mine.filter(r => r.run === run).flatMap(r => r.graded.map(g => g.score))),
    );
    const scores = all.map(g => g.score);
    const [lo, hi] = ci(scores);
    acc[f] = mean(scores);
    sds[f] = stats(runAcc).sd;
    overall[f] = {
      accuracy: `${p(acc[f])}%`,
      ci95: `${p(lo)}–${p(hi)}%`,
      sdAcrossRuns: sds[f],
      vsBaseline: '',
      n: all.length,
    };
  }
  for (const f of frameworks) {
    if (acc[BASELINE] === undefined || f === BASELINE) continue;
    const delta = acc[f]! - acc[BASELINE];
    // Below baseline by more than the noise we see between runs is worth a look.
    const noise = Math.max(sds[BASELINE]!, sds[f]!, 0.03);
    overall[f]!.vsBaseline =
      `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}pt${delta < -noise ? ' BELOW BASELINE' : ''}`;
  }
  const failures = results.flatMap(r =>
    r.graded.filter(g => g.score < 1).map(g => ({ framework: r.framework, scenario: r.scenario, run: r.run, ...g })),
  );
  const paired = results.flatMap(r => r.graded).filter(g => g.second !== undefined);
  const agreement = paired.length
    ? {
        judges: [JUDGE_MODEL, SECOND_JUDGE],
        n: paired.length,
        exact: `${p(mean(paired.map(g => (g.score === g.second ? 1 : 0))))}%`,
        meanAbsDiff: mean(paired.map(g => Math.abs(g.score - g.second!))).toFixed(3),
        secondJudgeAccuracy: Object.fromEntries(
          frameworks.map(f => [
            f,
            `${p(mean(results.filter(r => r.framework === f).flatMap(r => r.graded.map(g => g.second ?? NaN))))}%`,
          ]),
        ),
      }
    : null;
  writeFileSync(
    '/tmp/memory-eval.json',
    JSON.stringify(
      { judge: JUDGE_MODEL, answerer: MODEL, agreement, overall, byScenario, byAbility, judgeCheck, failures, results },
      null,
      2,
    ),
  );
}

const selected = SCENARIOS.filter(x => !scenarios || scenarios.includes(x.name));

describe.skipIf(!evalFile || !process.env.OPENAI_API_KEY)('memory quality eval (real models)', () => {
  afterAll(summarize);

  // A judge that can't give the reference answers full marks would make every score below meaningless.
  it('judge gives reference answers full marks', async () => {
    const qs = selected.flatMap(s => s.quiz.map((q: Question) => ({ s: s.name, ...q })));
    await Promise.all(
      qs.map(async q => judgeCheck.push({ scenario: q.s, q: q.q, ...(await judge(q.q, q.rubric, q.reference)) })),
    );
    expect(judgeCheck.filter(j => j.score < 1)).toEqual([]);
  }, 300_000);

  for (const s of selected) {
    for (const [name, make] of Object.entries(RUNNERS).filter(([n]) => !only || only.includes(n))) {
      for (let run = 1; run <= RUNS; run++) {
        it.concurrent(
          `${s.name} / ${name} #${run}`,
          async () => {
            const threadId = `eval-${s.name}-${name.replace(/\W/g, '')}-${run}-${Date.now()}`;
            const runner = make(threadId, s);
            for (const session of s.sessions) {
              for (const turn of session) await runner.ask(turn);
              await runner.settle();
            }
            const observations = await runner.observations();
            // Recall must come from observations: the first session's raw turns are no longer sent.
            const tail = runner.rawTail ? await runner.rawTail() : null;
            const compressed = tail === null ? null : !tail.includes(s.sessions[0]![0]!.slice(0, 40));
            // Each question gets its own copy of the thread so earlier answers can't influence later ones.
            const fork = async (id: string) => {
              if (runner.fork) return runner.fork(id);
              await client().cloneThread(threadId, { newThreadId: id });
              return make(id, s);
            };
            const graded: Graded[] = await Promise.all(
              s.quiz.map(async ({ q, rubric, ability }, i) => {
                const answer = await (await fork(`${threadId}-q${i}`)).ask(q);
                const [first, second] = await Promise.all([
                  judge(q, rubric, answer),
                  SECOND_JUDGE ? judge(q, rubric, answer, anthropic(SECOND_JUDGE)) : undefined,
                ]);
                return { q, ability, answer, ...first, second: second?.score };
              }),
            );
            const score = graded.reduce((a, g) => a + g.score, 0);
            results.push({ scenario: s.name, framework: name, run, score, of: s.quiz.length, compressed, observations, graded });
            summarize();
            expect(observations.length).toBeGreaterThan(0);
            if (compressed !== null) expect(compressed).toBe(true);
          },
          900_000,
        );
      }
    }
  }
});
