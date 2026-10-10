import { readFileSync, writeFileSync } from 'node:fs';
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
import { generateText, stepCountIs, tool, wrapLanguageModel } from 'ai';
import { createDeepAgent } from 'deepagents';
import { createAgent } from 'langchain';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { platformMemoryMiddleware } from './ai-sdk';
import { PlatformMemoryClient } from './client';
import { platformMemoryAgentMiddleware } from './langgraph';
import { withPlatformMemory } from './pi-agent';
import { PlatformMemory } from './platform-memory';

/**
 * Real-model memory quality eval. One realistic, single-thread scenario (Priya opening a second
 * bakery) is played through every framework adapter with a real agent model and the real
 * observer/reflector, then a quiz is graded by an LLM judge.
 *
 * Needs: OPENAI_API_KEY, PLATFORM_MEMORY_EVAL=<path to { instanceId, token }>, a local Platform API
 * on :3010 started with MEMORY_TEST_MODEL_URL=https://api.openai.com/v1 and MEMORY_TEST_MODEL_KEY, and
 * the instance configured with model openai/gpt-4.1-mini and the thresholds below.
 */
const evalFile = process.env.PLATFORM_MEMORY_EVAL;
const API = 'http://127.0.0.1:3010';
const MODEL = 'gpt-4.1-mini';
export const OBSERVATION_TOKENS = 1500;
export const REFLECTION_TOKENS = 4000;

type Scenario = {
  name: string;
  system: string;
  toolDescription: string;
  search: (query: string) => string;
  sessions: string[][];
  quiz: { q: string; rubric: string }[];
};

const padding = (label: string, line: (i: number) => string) =>
  Array.from({ length: 25 }, (_, i) => `${label}-${i}: ${line(i)}`).join('\n');

const SHOPS: Record<string, string> = {
  Alfama: 'Rua dos Remédios 41: 62m², €2,300/mo, ground floor, old oven, no extraction hood.',
  'Campo de Ourique': 'Rua Ferreira Borges 88: 75m², €2,900/mo, corner unit, full kitchen, high foot traffic.',
  Arroios: 'Rua Morais Soares 12: 70m², €2,100/mo, needs €15k refit, near metro.',
};
const LOGS: Record<string, string> = {
  checkout: 'ERROR checkout-api: pool exhausted (max=20) waiting for pg connection, p99 9.8s.',
  payments: 'WARN payments-worker: Stripe webhook retries 3x, all eventually 200.',
  inventory: 'ERROR inventory-sync: N+1 query on sku_variants, 4,200 queries per request since deploy v2.31.',
};
const FLIGHTS: Record<string, string> = {
  Tokyo: 'NH 203 SFO→HND dep 11:40 arr 15:25+1, $1,180 pp, 2 bags.',
  Osaka: 'JL 61 SFO→KIX dep 13:05 arr 17:10+1, $1,040 pp, 2 bags.',
  Sapporo: 'No direct; via HND, 19h total, $1,420 pp.',
};

const SCENARIOS: Scenario[] = [
  {
    name: 'bakery',
    system:
      'You are a concise business assistant for a baker. Use the search tool (query = neighborhood) when asked to search. Answer in 1-3 sentences.',
    toolDescription: 'Search retail listings in a Lisbon neighborhood',
    search: q =>
      `${SHOPS[q] ?? 'No featured listing.'}\n${padding(q, i => `${40 + i}m², €${1800 + i * 40}/mo, residential conversion, not food-licensed.`)}`,
    sessions: [
      [
        "Hi! I'm Priya. I run a small bakery called Forno Azul in Graça, Lisbon. I want to open a second shop this year.",
        "Important: I'm severely allergic to almonds, so nothing I make or taste can contain them. My business partner is Tomás; he handles finances.",
        'Our budget for the second shop is €180,000 total, including the refit.',
      ],
      [
        'Can you search for shops in Alfama, Campo de Ourique and Arroios and tell me which looks best?',
        'Let’s go with the Campo de Ourique one for now.',
      ],
      [
        'Update: Tomás renegotiated with the bank, the budget is now €240,000.',
        'We want to open on March 14, which is Pi Day — we’ll do a pastry pie special.',
        'Actually scratch Campo de Ourique, the landlord refused food licensing. We picked the Arroios shop instead.',
      ],
      [
        'Unrelated: what proofing temperature works best for a sourdough levain in winter?',
        'And how long should I cold-retard pastéis de nata dough?',
        'Any tips for keeping laminated dough from tearing?',
      ],
    ],
    quiz: [
      { q: 'What is our current budget for the second shop?', rubric: '€240,000 (not €180,000).' },
      {
        q: 'Which shop did we pick, and where?',
        rubric: 'The Arroios shop (Rua Morais Soares), not Campo de Ourique.',
      },
      { q: 'Why did we drop the other shop?', rubric: 'Campo de Ourique landlord refused food licensing.' },
      { q: 'When do we open, and what is special about it?', rubric: 'March 14, Pi Day, pie special.' },
      {
        q: 'Suggest a signature pastry for opening day.',
        rubric:
          'PASS if the suggested pastry does not use almonds, marzipan or frangipane as an ingredient. Words like "almond-free" mean it avoids almonds and are correct.',
      },
      { q: 'Who should I loop in about the refit costs?', rubric: 'Tomás, the business partner who handles finances.' },
      { q: 'What is the name of my current bakery and its neighborhood?', rubric: 'Forno Azul in Graça.' },
    ],
  },
  {
    name: 'incident',
    system:
      'You are an on-call SRE assistant. Use the search tool (query = service name) to read logs when asked. Answer in 1-3 sentences.',
    toolDescription: 'Fetch recent logs for a service (checkout, payments, inventory)',
    search: q =>
      `${LOGS[q] ?? 'No notable errors.'}\n${padding(q, i => `INFO request ${9000 + i} completed in ${120 + i}ms status=200`)}`,
    sessions: [
      [
        "I'm Dev, on call for Kestrel Outfitters. Checkout is timing out for customers since about 14:05 UTC.",
        'The customer escalating is Halvorsen Retail; their SLA is 99.9% monthly and they need an update every 30 minutes. My incident commander is Mei.',
      ],
      [
        'Pull logs for checkout, payments and inventory and tell me what you see.',
        'I think the payments webhook retries are the root cause. Let’s go with that.',
      ],
      [
        'Correction: payments is a red herring. Root cause is the inventory-sync N+1 query from deploy v2.31 starving the shared Postgres pool.',
        'We rolled back to v2.30 at 15:12 UTC and checkout recovered.',
        'Mei wants the postmortem filed under INC-4471 by Friday.',
      ],
      [
        'Unrelated: what is a sensible default for a pg pool size per Node pod?',
        'And should readiness probes check the database?',
        'How do I make p99 alerts less noisy?',
      ],
    ],
    quiz: [
      {
        q: 'What was the root cause?',
        rubric: 'inventory-sync N+1 query in v2.31 exhausting the Postgres pool; NOT payments webhooks.',
      },
      { q: 'How did we mitigate it and when?', rubric: 'Rolled back to v2.30 at 15:12 UTC.' },
      {
        q: 'Which customer escalated and how often do they need updates?',
        rubric: 'Halvorsen Retail, every 30 minutes.',
      },
      { q: 'What ticket should the postmortem go under and when is it due?', rubric: 'INC-4471, by Friday.' },
      { q: 'Who is my incident commander?', rubric: 'Mei.' },
      { q: 'When did the incident start?', rubric: 'About 14:05 UTC.' },
    ],
  },
  {
    name: 'trip',
    system:
      'You are a family travel planner. Use the search tool (query = destination city) to find flights when asked. Answer in 1-3 sentences.',
    toolDescription: 'Search flights from SFO to a Japanese city',
    search: q =>
      `${FLIGHTS[q] ?? 'No flights found.'}\n${padding(q, i => `codeshare ${i}: 2 stops, ${22 + (i % 5)}h, $${1500 + i * 25} pp`)}`,
    sessions: [
      [
        "Hi, I'm Marcus. Planning a Japan trip for me, my wife Lena, and our kids Ada (9) and Theo (4).",
        'Lena is vegetarian and Theo gets carsick on long drives. We fly from SFO.',
        'Tentative dates are April 3 to April 17.',
      ],
      ['Search flights to Tokyo, Osaka and Sapporo and recommend one.', 'Let’s plan to fly into Tokyo.'],
      [
        'Change of plan: Lena’s conference moved, so the trip is now April 10 to April 24.',
        'We’ll fly into Osaka instead, it’s cheaper, and take the train to Tokyo later.',
        'Our hotel budget is $350 per night max.',
      ],
      [
        'Unrelated: is a JR pass worth it in general?',
        'What are good rainy-day activities for kids in cities?',
        'Any tips for jet lag with young children?',
      ],
    ],
    quiz: [
      { q: 'What are our trip dates?', rubric: 'April 10 to April 24 (not April 3-17).' },
      { q: 'Which city do we fly into?', rubric: 'Osaka (KIX), not Tokyo.' },
      {
        q: 'Suggest a dinner spot type for our first night.',
        rubric: 'Must accommodate a vegetarian (Lena); PASS if it mentions vegetarian options.',
      },
      {
        q: 'Should we do a long day trip by car from Osaka?',
        rubric: 'Cautions against it or suggests train because Theo gets carsick.',
      },
      { q: 'What is our nightly hotel budget?', rubric: '$350 per night max.' },
      { q: 'How old are the kids and what are their names?', rubric: 'Ada 9 and Theo 4.' },
    ],
  },
];

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const creds = () => JSON.parse(readFileSync(evalFile!, 'utf8')) as { instanceId: string; token: string };
const client = () =>
  new PlatformMemoryClient({ apiUrl: API, accessToken: creds().token, instanceId: creds().instanceId });

type Runner = { ask(text: string): Promise<string>; settle(): Promise<void>; observations(): Promise<string> };

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
    return mastraRunner(
      s,
      memory,
      threadId,
      async () => {},
      async () =>
        (await (await store.getStore('memory'))!.getObservationalMemory(threadId, 'user'))?.activeObservations ?? '',
    );
  },
  PlatformMemory: (threadId, s) => {
    const p = platformSide(threadId);
    return mastraRunner(
      s,
      new PlatformMemory({ client: p.c, workingMemory: 'off' }),
      threadId,
      p.settle,
      p.observations,
    );
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

async function judge(q: string, rubric: string, answer: string) {
  const { text } = await generateText({
    model: openai(MODEL),
    prompt: `Grade an assistant's answer against a rubric. Reply with PASS or FAIL then a short reason.\nQuestion: ${q}\nRubric: ${rubric}\nAnswer: ${answer}`,
  });
  return text.trim().toUpperCase().startsWith('PASS');
}

const only = process.env.PLATFORM_MEMORY_EVAL_ONLY?.split(',');
const scenarios = process.env.PLATFORM_MEMORY_EVAL_SCENARIOS?.split(',');
const RUNS = Number(process.env.PLATFORM_MEMORY_EVAL_RUNS ?? 1);
const results: { scenario: string; framework: string; run: number; score: number; of: number; graded: unknown[] }[] =
  [];

function summarize() {
  const table: Record<string, Record<string, string>> = {};
  for (const r of results) {
    const scores = results.filter(x => x.scenario === r.scenario && x.framework === r.framework).map(x => x.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    (table[r.framework] ??= {})[r.scenario] =
      `${Math.min(...scores)}-${Math.max(...scores)}/${r.of} (mean ${mean.toFixed(1)}, n=${scores.length})`;
  }
  writeFileSync('/tmp/memory-eval.json', JSON.stringify({ table, results }, null, 2));
}

describe.skipIf(!evalFile || !process.env.OPENAI_API_KEY)('memory quality eval (real models)', () => {
  afterAll(summarize);
  for (const s of SCENARIOS.filter(x => !scenarios || scenarios.includes(x.name))) {
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
            const graded = [];
            for (const { q, rubric } of s.quiz) {
              const answer = await runner.ask(q);
              graded.push({ q, answer, pass: await judge(q, rubric, answer) });
            }
            const score = graded.filter(g => g.pass).length;
            results.push({ scenario: s.name, framework: name, run, score, of: s.quiz.length, graded });
            summarize();
            expect(observations.length).toBeGreaterThan(0);
          },
          900_000,
        );
      }
    }
  }
});
