/**
 * Shared plumbing for the real-provider durable-agent harness ports (COR-1443).
 *
 * The harness cases in `mastra-ai/durable-agent-validation` inspect provider traffic and the
 * persisted transcript, not just the final text. These helpers give each port the same two
 * observations the T78 port established:
 *
 * - `recordProviderRequests()` observes every provider request and its status *on top of* the
 *   llm-recorder, in both record and replay mode.
 * - `prefillRepairs` / `assistantEndedRequests` classify those requests the way the harness's
 *   `_util.mjs` does (F5/F7, COR-1312).
 *
 * This file is new for COR-1443; the recorder and the existing shared helpers
 * (`transform-request.ts`, `durable-agent-completion-feedback.test.ts`) are unchanged.
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';

export const PREFILL_REPAIR_MARKER = 'anthropic-prefill-processor-retry';

export const PROVIDERS = {
  anthropic: 'anthropic/claude-sonnet-4-6',
  openai: 'openai/gpt-5-mini',
} as const;

export type Provider = keyof typeof PROVIDERS;
export type Engine = 'plain' | 'durable' | 'evented';
export const ENGINES: Engine[] = ['plain', 'durable', 'evented'];

export type ModelRequest = { endpoint: string; body: any; status: number; responseText?: string };

/** Wrap `globalThis.fetch` so every provider request is recorded with its status. */
export function recordProviderRequests() {
  const requests: ModelRequest[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);
    // In record mode the recorder re-issues each request through MSW's `bypass()`, tagged
    // `accept: msw/passthrough`. Skip those so each request is counted once.
    const isBypass = input instanceof Request && !!input.headers.get('accept')?.includes('msw/passthrough');
    const url = new URL(input instanceof Request ? input.url : input);
    if (!isBypass && ['api.openai.com', 'api.anthropic.com'].includes(url.hostname)) {
      const entry: ModelRequest = {
        endpoint: url.origin + url.pathname,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
        status: response.status,
      };
      if (!response.ok) entry.responseText = await response.clone().text();
      requests.push(entry);
    }
    return response;
  }) as typeof fetch;
  return {
    requests,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

/** Role of the final conversational item a request ends on. */
export function lastTurn(body: any): string | null {
  const items = body?.messages ?? body?.input ?? [];
  const last = items.at(-1);
  if (!last) return null;
  // OpenAI Responses `item_reference` ids prefixed `msg_` point at a prior assistant message.
  if (last.type === 'item_reference') return String(last.id).startsWith('msg_') ? 'assistant' : 'reference';
  return last.role ?? last.type ?? null;
}

function providerOf(r: ModelRequest) {
  return r.endpoint.includes('anthropic') ? 'anthropic' : 'openai';
}

/**
 * Anthropic rejects a request that ends on an assistant turn with a prefill 400, and the default
 * handler repairs it by appending a marker. A repair with no assistant-ended request in front of
 * it is spurious.
 */
export function prefillRepairs(requests: ModelRequest[]) {
  const reqs = requests.map((r, i) => ({
    i,
    provider: providerOf(r),
    last: lastTurn(r.body),
    status: r.status,
    repair: JSON.stringify(r.body ?? '').includes(PREFILL_REPAIR_MARKER),
  }));
  const ended = reqs.filter(r => r.provider === 'anthropic' && r.last === 'assistant');
  const isRepairOf = (r: (typeof reqs)[number]) => {
    const next = reqs[r.i + 1];
    return !!next && next.repair && next.last !== 'assistant';
  };
  const repairIdx = new Set(ended.filter(isRepairOf).map(r => r.i + 1));
  return {
    ended,
    repaired: ended.filter(isRepairOf),
    unrepaired: ended.filter(r => !isRepairOf(r)),
    spurious: reqs.filter(r => r.repair && !repairIdx.has(r.i)),
  };
}

/** Requests that end on an assistant turn, split by provider (Anthropic rejects, OpenAI accepts). */
export function assistantEndedRequests(requests: ModelRequest[]) {
  const ended = requests
    .map((r, i) => ({ i, provider: providerOf(r), last: lastTurn(r.body) }))
    .filter(r => r.last === 'assistant');
  return {
    rejected: ended.filter(r => r.provider === 'anthropic'),
    accepted: ended.filter(r => r.provider !== 'anthropic'),
  };
}

export function errorChunks(chunks: any[]) {
  return chunks
    .filter(c => ['error', 'abort', 'tripwire'].includes(c.type))
    .map(c => String(c.payload?.error?.message ?? c.payload?.error ?? c.type));
}

/** The text the client stream produced, joined across deltas. */
export function textOf(chunks: any[]) {
  return chunks
    .filter(c => c.type === 'text-delta')
    .map(c => String(c.payload?.text ?? ''))
    .join('');
}

export function chunksOfType(chunks: any[], type: string) {
  return chunks.filter(c => c.type === type);
}

/**
 * One cell's real storage: a fresh LibSQL file plus `@mastra/memory` `Memory`, matching the way
 * the harness builds app memory. `cleanup()` removes the database directory.
 */
export async function createCellMemory(prefix: string) {
  const dbPath = await mkdtemp(join(tmpdir(), `${prefix}-`));
  const storage = new LibSQLStore({
    id: randomUUID(),
    url: `file:${join(dbPath, 'memory.db')}`,
  });
  const memory = new Memory({
    storage,
    options: { lastMessages: 40, semanticRecall: false, generateTitle: false, workingMemory: { enabled: false } },
  });
  return {
    storage,
    memory,
    async cleanup() {
      await rm(dbPath, { recursive: true, force: true });
    },
  };
}

/** Run one turn and return everything the checks need. */
export async function streamTurn(
  runner: any,
  engine: Engine,
  prompt: string,
  options: Record<string, any>,
): Promise<{ chunks: any[]; threw: string | null; finishPayloads: any[]; errorPayloads: any[] }> {
  const chunks: any[] = [];
  const finishPayloads: any[] = [];
  const errorPayloads: any[] = [];
  let threw: string | null = null;
  try {
    const result = await runner.stream(prompt, {
      ...options,
      onFinish: (payload: any) => {
        finishPayloads.push(payload);
        options.onFinish?.(payload);
      },
      onError: (payload: any) => {
        errorPayloads.push(payload);
        options.onError?.(payload);
      },
    });
    // Durable and evented runners wrap the agent stream in `output`.
    const output = engine === 'plain' || !result.output ? result : result.output;
    for await (const chunk of output.fullStream) chunks.push(chunk);
    result.cleanup?.();
  } catch (err: any) {
    threw = String(err?.message ?? err);
  }
  return { chunks, threw, finishPayloads, errorPayloads };
}

/** Stored user messages in a thread, read from memory rather than the stream. */
export async function persistedMessages(memory: Memory, thread: string, resource: string) {
  const recalled = await memory.recall({ threadId: thread, resourceId: resource, perPage: 50, hideSignals: false });
  return recalled.messages as any[];
}

export function messageText(message: any): string {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (typeof content?.content === 'string' && content.content.length > 0) {
    const parts = content.parts ?? [];
    const partText = Array.isArray(parts) ? parts.map((p: any) => p?.text ?? '').join('') : '';
    return content.content + partText;
  }
  const parts = content?.parts ?? [];
  return Array.isArray(parts) ? parts.map((p: any) => p?.text ?? '').join('') : '';
}
