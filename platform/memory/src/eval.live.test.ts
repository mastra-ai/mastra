import { Agent as PiAgent } from '@earendil-works/pi-agent-core';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { Type } from '@earendil-works/pi-ai';
import { getModel, streamSimple } from '@earendil-works/pi-ai/compat';
import { createOpenAI } from '@ai-sdk/openai';
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
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
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

const LISTINGS: Record<string, string> = {
  Alfama: 'Rua dos Remédios 41: 62m², €2,300/mo, ground floor, old oven, no extraction hood.',
  'Campo de Ourique': 'Rua Ferreira Borges 88: 75m², €2,900/mo, corner unit, full kitchen, high foot traffic.',
  Arroios: 'Rua Morais Soares 12: 70m², €2,100/mo, needs €15k refit, near metro.',
};
const filler = (area: string) =>
  Array.from(
    { length: 25 },
    (_, i) => `Listing ${area}-${i}: ${40 + i}m², €${1800 + i * 40}/mo, residential conversion, not food-licensed.`,
  ).join('\n');
const searchShops = (area: string) => `${LISTINGS[area] ?? 'No featured listing.'}\n${filler(area)}`;

const SESSIONS: string[][] = [
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
];

const QUIZ: { q: string; rubric: string }[] = [
  { q: 'What is our current budget for the second shop?', rubric: '€240,000 (not €180,000).' },
  { q: 'Which shop did we pick, and where?', rubric: 'The Arroios shop (Rua Morais Soares), not Campo de Ourique.' },
  { q: 'Why did we drop the other shop?', rubric: 'Campo de Ourique landlord refused food licensing.' },
  { q: 'When do we open, and what is special about it?', rubric: 'March 14, Pi Day, pie special.' },
  {
    q: 'Suggest a signature pastry for opening day.',
    rubric:
      'PASS if the suggested pastry does not use almonds, marzipan or frangipane as an ingredient. Words like "almond-free" mean it avoids almonds and are correct.',
  },
  { q: 'Who should I loop in about the refit costs?', rubric: 'Tomás, the business partner who handles finances.' },
  { q: 'What is the name of my current bakery and its neighborhood?', rubric: 'Forno Azul in Graça.' },
];

const SYSTEM =
  'You are a concise business assistant for a baker. Use the search_shops tool when asked to search. Answer in 1-3 sentences.';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const creds = () => JSON.parse(readFileSync(evalFile!, 'utf8')) as { instanceId: string; token: string };
const client = () =>
  new PlatformMemoryClient({ apiUrl: API, accessToken: creds().token, instanceId: creds().instanceId });

type Runner = { ask(text: string): Promise<string>; settle(): Promise<void>; observations(): Promise<string> };

function mastraRunner(
  memory: MastraMemory,
  threadId: string,
  settle: () => Promise<void>,
  obs: () => Promise<string>,
): Runner {
  const agent = new Agent({
    id: 'eval',
    name: 'eval',
    instructions: SYSTEM,
    model: openai(MODEL),
    memory,
    tools: {
      search_shops: createTool({
        id: 'search_shops',
        description: 'Search retail listings in a Lisbon neighborhood',
        inputSchema: z.object({ area: z.string() }),
        execute: async ({ area }) => searchShops(area),
      }),
    },
  });
  return {
    ask: async text =>
      (await agent.generate(text, { memory: { thread: threadId, resource: 'priya' }, maxSteps: 8 })).text,
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

const RUNNERS: Record<string, (threadId: string) => Runner> = {
  'OSS Memory': threadId => {
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
      memory,
      threadId,
      async () => {},
      async () =>
        (await (await store.getStore('memory'))!.getObservationalMemory(threadId, 'priya'))?.activeObservations ?? '',
    );
  },
  PlatformMemory: threadId => {
    const p = platformSide(threadId);
    return mastraRunner(new PlatformMemory({ client: p.c, workingMemory: 'off' }), threadId, p.settle, p.observations);
  },
  'AI SDK': threadId => {
    const p = platformSide(threadId);
    const model = wrapLanguageModel({
      model: openai(MODEL),
      middleware: platformMemoryMiddleware({ client: p.c, threadId, resourceId: 'priya' }),
    });
    const tools = {
      search_shops: tool({
        description: 'Search retail listings in a Lisbon neighborhood',
        inputSchema: z.object({ area: z.string() }),
        execute: async ({ area }) => searchShops(area),
      }),
    };
    return {
      ask: async prompt =>
        (await generateText({ model, system: SYSTEM, prompt, tools, stopWhen: stepCountIs(8) })).text,
      ...p,
    };
  },
  ...Object.fromEntries(
    (['LangGraph', 'Deep Agents'] as const).map(name => [
      name,
      (threadId: string): Runner => {
        const p = platformSide(threadId);
        const search = lcTool(async ({ area }: { area: string }) => searchShops(area), {
          name: 'search_shops',
          description: 'Search retail listings in a Lisbon neighborhood',
          schema: z.object({ area: z.string() }),
        });
        const opts = {
          model: new ChatOpenAI({ model: MODEL }),
          tools: [search],
          middleware: [platformMemoryAgentMiddleware({ client: p.c, resourceId: 'priya' })],
        };
        const agent =
          name === 'LangGraph'
            ? createAgent({ ...opts, systemPrompt: SYSTEM })
            : createDeepAgent({ ...opts, systemPrompt: SYSTEM });
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
  'pi agent': threadId => {
    const p = platformSide(threadId);
    const search: AgentTool = {
      name: 'search_shops',
      label: 'search_shops',
      description: 'Search retail listings in a Lisbon neighborhood',
      parameters: Type.Object({ area: Type.String() }),
      execute: async (_id, args) => ({
        content: [{ type: 'text', text: searchShops((args as { area: string }).area) }],
        details: {},
      }),
    };
    const agent = new PiAgent({
      streamFn: streamSimple as never,
      initialState: { systemPrompt: SYSTEM, model: getModel('openai', MODEL as never), tools: [search] },
      getApiKey: () => process.env.OPENAI_API_KEY,
    });
    withPlatformMemory(agent, { client: p.c, threadId, resourceId: 'priya' });
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
const results: Record<string, unknown> = {};

describe.skipIf(!evalFile || !process.env.OPENAI_API_KEY)('memory quality eval (real models)', () => {
  for (const [name, make] of Object.entries(RUNNERS)) {
    it.skipIf(only && !only.includes(name))(
      name,
      async () => {
        const threadId = `eval-${name.replace(/\W/g, '')}-${Date.now()}`;
        const runner = make(threadId);
        for (const session of SESSIONS) {
          for (const turn of session) await runner.ask(turn);
          await runner.settle();
        }
        const observations = await runner.observations();
        const graded = [];
        for (const { q, rubric } of QUIZ) {
          const answer = await runner.ask(q);
          graded.push({ q, answer, pass: await judge(q, rubric, answer) });
        }
        const score = graded.filter(g => g.pass).length;
        results[name] = { score: `${score}/${QUIZ.length}`, observed: observations.length > 0, graded, observations };
        writeFileSync('/tmp/memory-eval.json', JSON.stringify(results, null, 2));
        expect(observations.length).toBeGreaterThan(0);
        expect(score).toBeGreaterThanOrEqual(QUIZ.length - 1);
      },
      600_000,
    );
  }
});
