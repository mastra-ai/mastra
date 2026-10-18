import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { MastraMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { PlatformMemoryClient } from './client';
import { PlatformMemory } from './platform-memory';

/**
 * Scale run for PlatformMemory: many threads at once, multi-step turns, real observer/reflector
 * (OpenAI through the harness's Gateway shim), several replicas behind a round-robin proxy.
 * The same workload runs on local `Memory` as the baseline for how much the observer remembers.
 *
 * Reports step latency, errors (lease-busy 503s included) and recall of per-turn code words,
 * then writes a manifest for the SQL invariant check. Knobs: SCALE_THREADS, SCALE_TURNS,
 * SCALE_AGENT_DELAY_MS (simulated agent model latency), SCALE_BACKENDS (comma list),
 * SCALE_THRESHOLDS (JSON, must match the server's PARITY_THRESHOLDS).
 */
const live = !!process.env.PLATFORM_MEMORY_LIVE;
const envFile = process.env.PARITY_ENV_FILE ?? path.join(tmpdir(), 'platform-memory-parity.json');
const THREADS = Number(process.env.SCALE_THREADS ?? 20);
const TURNS = Number(process.env.SCALE_TURNS ?? 6);
const AGENT_DELAY_MS = Number(process.env.SCALE_AGENT_DELAY_MS ?? 0);
const THRESHOLDS = JSON.parse(
  process.env.SCALE_THRESHOLDS ?? '{"messageTokens":600,"observationTokens":1500,"bufferTokens":200}',
);
const BACKENDS = (process.env.SCALE_BACKENDS ?? 'Memory,PlatformMemory').split(',');
const RUN = process.env.SCALE_RUN ?? `scale-${Date.now()}`;
const MANIFEST = process.env.SCALE_MANIFEST ?? path.join(tmpdir(), 'platform-memory-scale.json');

const usage = { inputTokens: 10, outputTokens: 10, totalTokens: 20 };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const codeWord = (thread: number, turn: number) => `zx${thread}q${turn}k`;

const FILLER =
  'I spend weekends restoring an old sailboat, I am training for a half marathon, and my team ' +
  'is migrating a billing system off a legacy database while keeping invoices accurate. ';

/** Tool call on the first step of each turn, then a reply that echoes the turn. */
function agentModel() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      if (AGENT_DELAY_MS) await sleep(AGENT_DELAY_MS * (0.5 + Math.random()));
      const parts: unknown[] =
        prompt.at(-1)?.role === 'tool'
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: `Noted. ${FILLER}` },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: 'stop', usage },
            ]
          : [
              { type: 'stream-start', warnings: [] },
              { type: 'tool-call', toolCallId: `c${Math.random()}`, toolName: 'lookup', input: '{"q":"notes"}' },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ];
      return { stream: convertArrayToReadableStream(parts as never[]) };
    },
  });
}

const lookup = createTool({
  id: 'lookup',
  description: 'Looks up notes',
  inputSchema: z.object({ q: z.string() }),
  execute: async () => ({ notes: 'The user prefers concise answers. '.repeat(10) }),
});

function makeMemory(name: string): { memory: MastraMemory; observations: (t: string, r: string) => Promise<string> } {
  if (name === 'PlatformMemory') {
    const { apiUrl, instanceId, token } = JSON.parse(readFileSync(envFile, 'utf8'));
    const client = new PlatformMemoryClient({ apiUrl, accessToken: token, instanceId });
    return {
      memory: new PlatformMemory({ client, workingMemory: 'off' }),
      observations: async (t, r) => (await client.getContext(t, r)).system ?? '',
    };
  }
  const memory = new Memory({
    storage: new InMemoryStore(),
    options: {
      observationalMemory: {
        enabled: true,
        observation: {
          model: 'openai/gpt-4o-mini',
          messageTokens: THRESHOLDS.messageTokens,
          bufferTokens: THRESHOLDS.bufferTokens,
        },
        reflection: { model: 'openai/gpt-4o-mini', observationTokens: THRESHOLDS.observationTokens },
      },
    },
  });
  return {
    memory,
    observations: async (t, r) => {
      await (await memory.omEngine)?.settled();
      return (await memory.getContext({ threadId: t, resourceId: r })).systemMessage ?? '';
    },
  };
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]! : 0;
};

const results: Record<string, unknown> = {};

describe.skipIf(!live).each(BACKENDS)('scale (%s)', name => {
  it(`${THREADS} threads x ${TURNS} turns`, { timeout: 30 * 60_000 }, async () => {
    const { memory, observations } = makeMemory(name);
    const agent = new Agent({
      id: 'scale',
      name: 'scale',
      instructions: 'You are a helpful assistant.',
      model: agentModel() as never,
      tools: { lookup },
      memory,
    });
    const turnMs: number[] = [];
    const errors: string[] = [];
    const threads = Array.from({ length: THREADS }, (_, i) => ({
      threadId: `${RUN}-${name}-t${i}`,
      resourceId: `${RUN}-${name}-r${i}`,
    }));

    const started = Date.now();
    await Promise.all(
      threads.map(async ({ threadId, resourceId }, i) => {
        for (let turn = 0; turn < TURNS; turn++) {
          const t0 = Date.now();
          try {
            const text = `Turn ${turn}. Please remember my code word for today is ${codeWord(i, turn)}. ${FILLER}`;
            // SCALE_RESEND=1 models a chat UI that loads the thread from storage and resends all of it.
            const history =
              process.env.SCALE_RESEND === '1' && turn > 0
                ? (await memory.recall({ threadId, resourceId, perPage: false })).messages
                : [];
            const out = await agent.stream([...history, { role: 'user', content: text }] as never, {
              memory: { thread: threadId, resource: resourceId },
              maxSteps: 3,
            });
            await out.consumeStream();
            const err = (await out.error) as Error | undefined;
            if (err) errors.push(`${threadId}#${turn}: ${err.message}`);
          } catch (err) {
            errors.push(`${threadId}#${turn}: ${(err as Error).message}`);
          }
          turnMs.push(Date.now() - t0);
        }
      }),
    );
    const wallMs = Date.now() - started;

    // Recall: code words the next turn's context still carries (observations, or raw messages
    // not yet observed are not counted, so this measures what the observer kept).
    let remembered = 0;
    for (const [i, { threadId, resourceId }] of threads.entries()) {
      const text = await observations(threadId, resourceId);
      for (let turn = 0; turn < TURNS; turn++) if (text.includes(codeWord(i, turn))) remembered++;
    }

    let markerOnly = 0;
    let sealed = 0;
    let withMarkers = 0;
    if (name !== 'PlatformMemory') {
      for (const { threadId, resourceId } of threads) {
        const { messages } = await memory.recall({ threadId, resourceId, perPage: false });
        sealed += messages.filter(m => (m.content.metadata as any)?.mastra?.sealed === true).length;
        withMarkers += messages.filter(m => m.content.parts.some(p => p.type.startsWith('data-om-'))).length;
        markerOnly += messages.filter(
          m => m.content.parts.length > 0 && m.content.parts.every(p => p.type.startsWith('data-om-')),
        ).length;
      }
    }

    const summary = {
      markerOnly,
      sealed,
      withMarkers,
      turns: turnMs.length,
      errors: errors.length,
      sampleErrors: errors.slice(0, 5),
      turnMs: { p50: pct(turnMs, 50), p95: pct(turnMs, 95), max: pct(turnMs, 100) },
      wallMs,
      recallPct: Math.round((remembered / (THREADS * TURNS)) * 100),
    };
    results[name] = { ...summary, threads };
    console.log(`SCALE ${name} ${JSON.stringify(summary)}`);
    const { writeFileSync } = await import('node:fs');
    writeFileSync(MANIFEST, JSON.stringify({ run: RUN, turns: TURNS, results }, null, 2));
    expect(errors).toEqual([]);
  });
});
