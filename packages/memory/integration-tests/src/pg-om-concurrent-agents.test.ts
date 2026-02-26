/**
 * Concurrent Agents + Observational Memory + PostgreSQL — deadlock reproduction
 *
 * Runs many agents sharing the same resourceId (different threadIds) in parallel,
 * with low OM thresholds so observation triggers frequently. Verifies that
 * observation actually fires and that no deadlock occurs.
 *
 * Run manually:
 *   cd packages/memory/integration-tests
 *   pnpm install --ignore-workspace   # first time only
 *   docker compose up -d postgres
 *   OPENAI_API_KEY=sk-... npx vitest run ./src/pg-om-concurrent-agents.test.ts
 *
 * Requires:
 *   - Docker Compose PG running (port 5434)
 *   - OPENAI_API_KEY env var (or .env file)
 */

import { randomUUID } from 'node:crypto';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

config();

const PG_CONNECTION = {
  host: 'localhost',
  port: 5434,
  user: 'postgres',
  password: 'password',
  database: 'mastra',
};

const AGENT_MODEL = 'openai/gpt-4o-mini';
const OM_MODEL = 'openai/gpt-4o-mini';

const AGENT_COUNT = 6;
const TURNS_PER_AGENT = 6;

// Very low threshold — a single short exchange should exceed this
const MESSAGE_TOKENS = 100;
const OBSERVATION_TOKENS = 50_000; // high — avoid reflection during test

// A simple tool that forces a tool call on step 0, making step 1's
// processInputStep run with stepNumber > 0, which is where observation triggers.
const lookupTool = createTool({
  id: 'lookup_info',
  description:
    'Look up additional context or facts about a topic. ALWAYS call this tool before answering any question.',
  inputSchema: z.object({
    query: z.string().describe('The topic to look up'),
  }),
  execute: async (input: { query: string }) => {
    return { info: `Here is some context about "${input.query}": This is a well-documented topic.` };
  },
});

const prompts = [
  'Tell me three fun facts about the ocean. Be detailed and thorough in your response.',
  'Explain how a combustion engine works step by step. Include all major components.',
  'What are the main differences between Python and JavaScript? Give code examples.',
  'Describe the process of photosynthesis in detail. Include the chemical equations.',
  'Tell me about the history of the internet from ARPANET to modern day.',
  'Explain quantum computing to someone who knows classical computing well.',
];

describe.skip('Concurrent agents with OM on PostgreSQL — deadlock reproduction', () => {
  let storage: PostgresStore;
  const resourceId = `resource-${randomUUID()}`;

  beforeAll(async () => {
    storage = new PostgresStore({ id: 'om-deadlock-test', ...PG_CONNECTION });
    await storage.init();
  });

  afterAll(async () => {
    try {
      await (storage as any).stores?.memory?.db?.client?.query(
        `DELETE FROM mastra_observational_memory WHERE "resourceId" LIKE 'resource-%'`,
      );
    } catch {}
    try {
      await storage.close();
    } catch {}
  });

  it(`should run ${AGENT_COUNT} agents x ${TURNS_PER_AGENT} turns with observation triggering and no deadlock`, async () => {
    const memory = new Memory({
      storage,
      options: {
        lastMessages: 20,
        generateTitle: false,
        observationalMemory: {
          observation: {
            model: OM_MODEL,
            messageTokens: MESSAGE_TOKENS,
            bufferTokens: false, // synchronous — maximum DB contention
          },
          reflection: {
            model: OM_MODEL,
            observationTokens: OBSERVATION_TOKENS,
          },
        },
      },
    });

    const agents = Array.from(
      { length: AGENT_COUNT },
      (_, i) =>
        new Agent({
          id: `concurrent-agent-${i}`,
          name: `Agent ${i}`,
          instructions:
            'You are a helpful assistant. You MUST call the lookup_info tool before answering any question. Give detailed, thorough answers of at least 3-4 sentences after looking up the topic.',
          model: AGENT_MODEL,
          memory,
          tools: { lookupTool },
        }),
    );

    const threadIds = agents.map((_, i) => `thread-${resourceId}-${i}`);
    const errors: Error[] = [];

    // Run all agents concurrently, each doing multiple turns
    const agentTasks = agents.map(async (agent, agentIdx) => {
      const threadId = threadIds[agentIdx]!;
      for (let turn = 0; turn < TURNS_PER_AGENT; turn++) {
        const prompt = prompts[turn % prompts.length]!;
        try {
          const result = await agent.generate(`[Turn ${turn + 1}] ${prompt}`, {
            memory: {
              thread: threadId,
              resource: resourceId,
            },
          });
          expect(result.text).toBeTruthy();
          console.log(`Agent ${agentIdx} turn ${turn + 1}: ${result.text.length} chars, ${result.steps.length} steps`);
        } catch (err: any) {
          console.error(`Agent ${agentIdx} turn ${turn + 1} failed:`, err.message);
          errors.push(err);
          // Don't throw — let other agents continue so we can see if multiple deadlock
          break;
        }
      }
    });

    await Promise.all(agentTasks);

    // Now check if observation actually triggered for at least some threads
    const memoryStore = (storage as any).stores?.memory;
    let observationCount = 0;
    for (const threadId of threadIds) {
      try {
        const record = await memoryStore?.getObservationalMemory(threadId, resourceId);
        if (record?.activeObservations) {
          observationCount++;
          console.log(`Thread ${threadId}: observation triggered (${record.activeObservations.length} chars)`);
        } else if (record) {
          console.log(`Thread ${threadId}: OM record exists but no observations yet`);
        } else {
          console.log(`Thread ${threadId}: no OM record found`);
        }
      } catch (err: any) {
        console.log(`Thread ${threadId}: error checking OM record: ${err.message}`);
      }
    }

    console.log(`\nObservation triggered for ${observationCount}/${threadIds.length} threads`);

    if (errors.length > 0) {
      throw new Error(`${errors.length} agent(s) failed:\n${errors.map(e => e.message).join('\n')}`);
    }

    // At least some agents should have triggered observation
    expect(observationCount).toBeGreaterThan(0);
  }, 300_000); // 5 min timeout
});
