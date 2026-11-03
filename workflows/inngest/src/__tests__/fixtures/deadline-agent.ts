/**
 * Shared by the deadline test and its connect workers: every process builds the same agent and the
 * same observability, so the run looks like one deploy with an API replica and a worker pool.
 *
 * Every process appends its span starts/ends and model calls to files under `logDir`, so the test
 * sees what each worker did without going through storage.
 */
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { TracingEvent } from '@mastra/core/observability';
import { createTool } from '@mastra/core/tools';
import { DefaultStorage } from '@mastra/libsql';
import { BaseExporter, MastraStorageExporter, Observability } from '@mastra/observability';
import { simulateReadableStream } from 'ai';
import { Inngest } from 'inngest';
import { z } from 'zod';

import { createInngestAgent } from '../../durable-agent';
import { createInngestDurableAgenticWorkflow } from '../../durable-agent/create-inngest-agentic-workflow';

/**
 * The budget is armed in the caller when `stream()` returns, so Inngest's dispatch of the first
 * step to a worker eats into it. It is generous enough that the first model call lands before the
 * deadline on a loaded machine; the test asserts that it did.
 */
export const TOTAL_TIMEOUT_MS = 6000;
/** How long the tool keeps running after the deadline aborts it, as a slow upstream call does. */
export const TOOL_AFTER_DEADLINE_MS = 1000;
/** The tool returns at the latest here, so a deadline that never reaches it still ends the test. */
export const TOOL_CAP_MS = TOTAL_TIMEOUT_MS + 10_000;

export interface SpanRow {
  pid: number;
  event: TracingEvent['type'];
  spanId: string;
  type: string;
  runId?: string;
  outcome: unknown;
  stopReason: unknown;
}

export interface ModelCallRow {
  pid: number;
  afterTool: boolean;
  at: number;
}

export const spanLogPath = (logDir: string) => path.join(logDir, 'spans.jsonl');
export const modelLogPath = (logDir: string) => path.join(logDir, 'model-calls.jsonl');

class JsonlSpanExporter extends BaseExporter {
  name = 'jsonl-spans';
  constructor(private readonly file: string) {
    super({});
  }
  async _exportTracingEvent(event: TracingEvent): Promise<void> {
    if (event.type === 'span_updated') return;
    const span = event.exportedSpan;
    if (!span) return;
    const row: SpanRow = {
      pid: process.pid,
      event: event.type,
      spanId: span.id,
      type: span.type,
      runId: span.metadata?.runId as string | undefined,
      outcome: span.outcome ?? null,
      stopReason: span.stopReason ?? null,
    };
    appendFileSync(this.file, JSON.stringify(row) + '\n');
  }
}

/** Calls `slow` first, then answers; every model call is logged with the process that made it. */
function slowThenTextModel(logDir: string): any {
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'mock-model',
    supportedUrls: {},
    async doStream({ prompt }: { prompt: Array<{ role: string }> }) {
      const stepped = prompt.some(message => message.role === 'tool');
      appendFileSync(
        modelLogPath(logDir),
        JSON.stringify({ pid: process.pid, afterTool: stepped, at: Date.now() } satisfies ModelCallRow) + '\n',
      );
      const chunks = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: stepped ? 'id-1' : 'id-0', modelId: 'mock-model', timestamp: new Date(0) },
        ...(stepped
          ? [
              { type: 'text-start', id: 't1' },
              { type: 'text-delta', id: 't1', delta: 'done' },
              { type: 'text-end', id: 't1' },
            ]
          : [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'slow',
                input: JSON.stringify({}),
                providerExecuted: false,
              },
            ]),
        {
          type: 'finish',
          finishReason: stepped ? 'stop' : 'tool-calls',
          usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
        },
      ];
      return {
        stream: simulateReadableStream({ chunks: chunks as any }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}

export function buildDeadlineAgent({
  dbUrl,
  agentId,
  inngestPort,
  logDir,
}: {
  dbUrl: string;
  agentId: string;
  inngestPort: number;
  logDir: string;
}) {
  const inngest = new Inngest({ id: 'deadline-test', baseUrl: `http://localhost:${inngestPort}` });
  const slow = createTool({
    id: 'slow',
    description: 'A slow operation.',
    inputSchema: z.object({}),
    // Outlives the deadline by construction: it returns a moment after the run's abort signal
    // fires, so neither a fast nor a slow machine changes what the test proves.
    execute: async (_input, context) => {
      const signal = (context as { abortSignal?: AbortSignal } | undefined)?.abortSignal;
      await new Promise<void>(resolve => {
        const afterDeadline = () => setTimeout(resolve, TOOL_AFTER_DEADLINE_MS);
        if (!signal || signal.aborted) return afterDeadline();
        signal.addEventListener('abort', afterDeadline, { once: true });
        setTimeout(resolve, TOOL_CAP_MS);
      });
      return { ok: true };
    },
  });
  const storage = new DefaultStorage({ id: `deadline-${agentId}`, url: dbUrl });
  const agent = new Agent({
    id: agentId,
    name: 'Deadline Agent',
    instructions: 'Call slow, then answer.',
    model: slowThenTextModel(logDir),
    tools: { slow },
  });
  const durableAgent = createInngestAgent({ agent, inngest });
  const workflow = createInngestDurableAgenticWorkflow({ inngest });
  const mastra = new Mastra({
    storage,
    agents: { [agentId]: durableAgent } as any,
    workflows: { [workflow.id]: workflow } as any,
    observability: new Observability({
      configs: {
        default: {
          serviceName: 'deadline-test',
          exporters: [
            new MastraStorageExporter({ strategy: 'insert-only', maxBatchWaitMs: 25 }),
            new JsonlSpanExporter(spanLogPath(logDir)),
          ],
        },
      },
    }),
  });
  return { inngest, mastra, durableAgent, storage };
}
