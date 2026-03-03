import { existsSync } from 'node:fs';

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { Memory } from '../../../../index';
import { runStreamAndCollectUsage, seedConversationTurns } from '../cache-test-utils';
import { PersistableInMemoryStore } from '../persistable-memory-test-util';
import { formatRoundReport, parseSeedSessionArgs } from './seed-om-session.utils';
import type { SeedSessionCliArgs } from './seed-om-session.utils';

const MASTRA_ROOT_URL = 'https://mastra.ai';

function extractPageTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.trim() ?? 'Untitled';
}

function extractTextSnippet(html: string) {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return withoutScripts.slice(0, 4_000);
}

function extractLinks(baseUrl: string, html: string) {
  const matches = Array.from(html.matchAll(/href=["']([^"']+)["']/gi));
  const links = new Set<string>();

  for (const [, href] of matches) {
    if (!href) continue;

    try {
      const resolved = new URL(href, baseUrl);
      links.add(resolved.toString());
    } catch {
      // skip bad urls
    }
  }

  return Array.from(links).slice(0, 20);
}

function normalizeUrl(raw: string) {
  try {
    const url = new URL(raw);
    url.hash = '';

    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    return raw;
  }
}

const MAX_FETCH_CALLS = 200;
const fetchCache = new Map<
  string,
  {
    url: string;
    title: string;
    textSnippet: string;
    links: string[];
    statusCode?: number;
    statusText?: string;
    ok: boolean;
  }
>();
let totalFetchCalls = 0;
let duplicateFetches = 0;
let fetchBudgetLogged = false;

const fetchUrlTool = createTool({
  id: 'fetchUrl',
  description: 'Fetch a page from mastra.ai and return normalized content plus discovered links.',
  inputSchema: z.object({
    url: z.string().url().optional().describe('A mastra.ai URL to fetch. Defaults to https://mastra.ai'),
  }),
  execute: async ({ url }) => {
    const targetUrl = normalizeUrl(url ?? MASTRA_ROOT_URL);

    totalFetchCalls += 1;

    if (totalFetchCalls > MAX_FETCH_CALLS) {
      if (!fetchBudgetLogged) {
        fetchBudgetLogged = true;
        console.warn(`[fetchUrl] reached fetch budget (${MAX_FETCH_CALLS}), skipping additional new requests`);
      }

      return {
        url: targetUrl,
        title: `Fetch skipped: reached fetch budget (${MAX_FETCH_CALLS})`,
        textSnippet: '',
        links: [],
        ok: false,
      };
    }

    const cached = fetchCache.get(targetUrl);
    if (cached) {
      duplicateFetches += 1;

      if (duplicateFetches <= 5 || duplicateFetches % 25 === 0) {
        console.log(`[fetchUrl] SKIP duplicate ${targetUrl} (count=${duplicateFetches})`);
      }

      return {
        ...cached,
      };
    }

    console.log(`[fetchUrl] GET ${targetUrl}`);

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'user-agent': 'mastra-om-seed-script/1.0',
        },
      });

      if (!response.ok) {
        const failedResult = {
          url: targetUrl,
          title: `Fetch failed: ${response.status} ${response.statusText}`,
          textSnippet: '',
          links: [],
          statusCode: response.status,
          statusText: response.statusText,
          ok: false,
        };

        fetchCache.set(targetUrl, failedResult);
        return failedResult;
      }

      const html = await response.text();
      const links = extractLinks(targetUrl, html);

      const successResult = {
        url: targetUrl,
        title: extractPageTitle(html),
        textSnippet: extractTextSnippet(html),
        links,
        statusCode: response.status,
        statusText: response.statusText,
        ok: true,
      };

      fetchCache.set(targetUrl, successResult);
      return successResult;
    } catch (error) {
      const failedResult = {
        url: targetUrl,
        title: `Fetch failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        textSnippet: '',
        links: [],
        ok: false,
      };

      fetchCache.set(targetUrl, failedResult);
      return failedResult;
    }
  },
});

export { fetchUrlTool };

export function buildSeedAgentInstructions() {
  return [
    'You are a relentless researcher focused on the Mastra website.',
    'Use the fetchUrl tool repeatedly to explore pages on https://mastra.ai.',
    'Before each round summary, make multiple tool calls, follow newly discovered links, and cite the URLs you visited.',
    'If a crawl returns ok=false, continue with other pages and record that the URL was unreachable.',
    'Keep digging for architecture details, APIs, implementation behavior, and edge cases.',
  ].join(' ');
}

export { MASTRA_ROOT_URL };

export function buildRoundPrompt(prompt: string, round: number, rounds: number) {
  return `${prompt}\n\nRound ${round}/${rounds}: crawl https://mastra.ai, follow links you discover, then provide your latest deep-research update with visited URLs.`;
}

export { DEFAULT_PROMPT, DEFAULT_ROUNDS, DEFAULT_SEED_MODEL } from './seed-om-session.utils';
export { formatRoundReport, parseSeedSessionArgs } from './seed-om-session.utils';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
};

const colorize = (text: string, color: string) => `${color}${text}${ANSI.reset}`;
const formatToolLine = (label: string, values: string[], color: string) =>
  values.length > 0 ? `${colorize(`[${label}]`, ANSI.bold + color)} ${values.join(', ')}` : '';

const fmtTokenCount = (value: unknown) => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    return '?';
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return String(Math.round(n));
};

const makeBar = (current: number, max: number, width = 14) => {
  const safeMax = Math.max(max, 1);
  const ratio = Math.max(0, Math.min(1, current / safeMax));
  const active = Math.round(ratio * width);

  const fill = '█'.repeat(active);
  const empty = '·'.repeat(Math.max(0, width - active));

  return `${ANSI.green}${fill}${ANSI.dim}${empty}${ANSI.reset}`;
};

const summarizeOmPart = (part: { type: string; data?: unknown }) => {
  const payload = typeof part.data === 'object' && part.data !== null ? (part.data as Record<string, unknown>) : null;

  if (part.type === 'data-om-status' && payload) {
    const windows = (payload.windows ?? {}) as {
      active?: {
        messages?: { tokens?: number; threshold?: number };
        observations?: { tokens?: number; threshold?: number };
      };
      buffered?: { observations?: { chunks?: number; status?: string }; reflection?: { status?: string } };
    };

    const active = windows.active;

    const msgCurrent = active?.messages?.tokens ?? 0;
    const msgMax = active?.messages?.threshold ?? 0;
    const obsCurrent = active?.observations?.tokens ?? 0;
    const obsMax = active?.observations?.threshold ?? 0;

    return `${ANSI.yellow}messages${ANSI.reset} [${makeBar(msgCurrent, msgMax)}] ${fmtTokenCount(msgCurrent)} / ${fmtTokenCount(msgMax)}  ${ANSI.magenta}memory${ANSI.reset} [${makeBar(obsCurrent, obsMax)}] ${fmtTokenCount(obsCurrent)} / ${fmtTokenCount(obsMax)} ${part.type}`;
  }

  if (part.type === 'data-om-buffering-start' && payload) {
    const target = fmtTokenCount(payload.tokensToBuffer ?? 0);
    const cycle = String(payload.cycleId ?? '?');
    return `${ANSI.blue}Buffered observation${ANSI.reset}: ${colorize('ready', ANSI.yellow)} ${colorize('→', ANSI.dim)} ${target} tokens (cycle ${cycle})`;
  }

  if (part.type === 'data-om-buffering-end' && payload) {
    const buffered = fmtTokenCount(payload.tokensBuffered ?? 0);
    const projected = fmtTokenCount(payload.tokensToBuffer ?? 0);
    const op = String(payload.operationType ?? '?');
    const cycle = String(payload.cycleId ?? '?');

    return `${ANSI.green}✓ Buffered observation${ANSI.reset}: ${fmtTokenCount(projected)} → ${buffered} tokens (${op} ${cycle})`;
  }

  if (part.type === 'data-om-observation-start' && payload) {
    return `${ANSI.green}Observation phase${ANSI.reset}: ${String(payload.operationType ?? '?')} ${colorize('cycle', ANSI.dim)} ${String(payload.cycleId ?? '?')}`;
  }

  if (part.type === 'data-om-observation-end' && payload) {
    return `${ANSI.green}Observation done${ANSI.reset} · ${ANSI.dim}${String(payload.operationType ?? '?')} ${String(payload.cycleId ?? '?')} · ${String(payload.durationMs ?? '?')}ms${ANSI.reset}`;
  }

  if (part.type === 'data-om-activation' && payload) {
    return `${ANSI.magenta}Activation${ANSI.reset}: cycle ${String(payload.cycleId ?? '?')} · threshold ${fmtTokenCount(payload.messageTokenThreshold ?? 0)}`;
  }

  return `${part.type}${payload ? ` data=${JSON.stringify(payload).slice(0, 120)}` : ''}`;
};

export async function runSeedSession(args: SeedSessionCliArgs) {
  const stateFile = args.stateFile ?? 'seed-om-session-state.json';
  const store = new PersistableInMemoryStore();
  const memoryStore = await store.getStore('memory');

  if (!memoryStore) {
    throw new Error('Failed to acquire memory store for seed session');
  }

  const persistState = async () => {
    await store.persist(stateFile);
    console.log(`\n[seed] persisted OM state -> ${stateFile}`);
  };

  const handleExit = async (signal?: string) => {
    await persistState();

    if (signal) {
      process.exit(0);
    }
  };

  if (existsSync(stateFile)) {
    await store.hydrate(stateFile);
    console.log(`[seed] hydrated OM state from ${stateFile}`);
  }

  const memory = new Memory({
    storage: store,
    options: {
      observationalMemory: {
        enabled: true,
        model: args.model,
      },
    },
  });

  const agent = new Agent({
    id: 'seed-om-session-agent',
    name: 'Seed OM Session Agent',
    instructions: buildSeedAgentInstructions(),
    model: args.model,
    tools: {
      fetchUrl: fetchUrlTool,
    },
    memory,
  });

  await seedConversationTurns({
    store: store as unknown as {
      getStore: (name: string) => Promise<
        | {
            saveThread: (args: {
              thread: {
                id: string;
                title: string;
                resourceId: string;
                createdAt: Date;
                updatedAt: Date;
                metadata: unknown;
              };
            }) => Promise<unknown>;
            saveMessages: (args: {
              messages: {
                id?: string;
                threadId: string;
                role: 'user' | 'assistant';
                content: unknown;
                createdAt: Date;
                type: string;
              }[];
            }) => Promise<unknown>;
          }
        | undefined
      >;
    },
    threadId: args.threadId,
    resourceId: args.resourceId,
    turns: 8,
  });

  process.once('SIGINT', () => {
    void handleExit('SIGINT');
  });
  process.once('SIGTERM', () => {
    void handleExit('SIGTERM');
  });

  for (let round = 1; round <= args.rounds; round += 1) {
    const prompt = buildRoundPrompt(args.prompt, round, args.rounds);

    console.log(`\n--- round ${round}/${args.rounds} live output ---`);
    const maxAttempts = 2;
    let result: Awaited<ReturnType<typeof runStreamAndCollectUsage>> | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        result = await runStreamAndCollectUsage({
          agent,
          prompt,
          threadId: args.threadId,
          resourceId: args.resourceId,
          maxSteps: 50,
          onTextDelta: delta => process.stdout.write(delta),
          onStepFinish: step => {
            const lines = [
              formatToolLine('tool calls', step.toolCallNames ?? [], ANSI.cyan),
              formatToolLine('tool results', step.toolResultNames ?? [], ANSI.green),
            ]
              .filter(Boolean)
              .map(line => String(line));

            const omLines = (step.dataParts ?? [])
              .map(part => summarizeOmPart(part))
              .filter((value, index, array) => array.indexOf(value) === index)
              .map(value => `${colorize('OM', ANSI.bold + ANSI.magenta)} ${value}`);

            for (const line of [...lines, ...omLines]) {
              console.log(`\n${line}`);
            }
          },
        });

        break;
      } catch (error) {
        if (attempt >= maxAttempts) {
          await persistState();
          throw error;
        }

        const delayMs = attempt * 1_000;

        console.error(`Round ${round} attempt ${attempt} failed, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    if (!result) {
      throw new Error(`Round ${round} failed after ${maxAttempts} attempts.`);
    }

    console.log('\n--- end live output ---');
    console.log(formatRoundReport(round, result.usage));
  }

  const omRecord = await memoryStore.getObservationalMemory(args.threadId, args.resourceId);

  await persistState();

  console.log(
    `om-summary activeObservationChars=${omRecord?.activeObservations?.length ?? 0} observationTokens=${omRecord?.observationTokenCount ?? 0} totalObserved=${omRecord?.totalTokensObserved ?? 0}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!process.env.CEREBRAS_API_KEY) {
    console.error('Missing CEREBRAS_API_KEY. Set it before running seed-om-session.ts');
    process.exit(1);
  }

  const args = parseSeedSessionArgs(process.argv.slice(2));

  runSeedSession(args)
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}
