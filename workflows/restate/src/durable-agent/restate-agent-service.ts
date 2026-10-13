import type { Agent, AgentExecutionOptions } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core/llm';
import type { Mastra } from '@mastra/core/mastra';
import type { ChunkType } from '@mastra/core/stream';
import * as restate from '@restatedev/restate-sdk';
import { TerminalError } from '@restatedev/restate-sdk';

import { sanitizeChunk, serializeMessages, serializeOptions } from '../serde';
import type {
  RestateAgentRunRequest,
  RestateAgentRunResult,
  RestateApprovalResolution,
  RestateRunState,
  RestateSerializableOptions,
  RestateStreamEvent,
} from '../types';

/** Options for {@link createRestateAgentService}. */
export interface CreateRestateAgentServiceOptions {
  /** The Mastra Agent whose runs this service executes durably. */
  agent: Agent<any, any, any>;
  /** Restate service name (defaults to `MastraAgent_<agentId>`). */
  serviceName?: string;
  /** Mastra instance for observability (optional). */
  mastra?: Mastra;
  /** Max retry attempts for journaled agent-run steps. */
  maxRetryAttempts?: number;
}

/** The Mastra durable-agent service: stateless handlers, durable journal. */
export interface RestateAgentService {
  service: restate.Service<any>;
  serviceName: string;
  /** Per-run in-memory state (discovery/observability; durable state is journaled). */
  runs: Map<string, RestateRunState>;
}

const DEFAULT_MAX_RETRY_ATTEMPTS = 3;

/**
 * Build the Restate service definition that executes Mastra agent runs
 * durably. The service closes over the Mastra `Agent` instance — Restate
 * invokes the handler in the process that called `restate.serve(...)`, so
 * the agent, its model, tools, and memory are all available in-process.
 *
 * Durability model:
 * - Each agent invocation is journaled as one Restate step (`ctx.run`).
 *   Completed invocations replay from the journal without re-executing
 *   LLM calls or tool side effects.
 * - Tool approvals suspend durably via Restate awakeables: the handler
 *   parks without holding compute and resumes when the awakeable resolves,
 *   even across process restarts.
 * - Stream events are recorded per run and exposed via `getRun` for
 *   `observe()`.
 */
export function createRestateAgentService(options: CreateRestateAgentServiceOptions): RestateAgentService {
  const { agent, mastra: _mastra, maxRetryAttempts = DEFAULT_MAX_RETRY_ATTEMPTS } = options;
  const serviceName = options.serviceName ?? `MastraAgent_${agent.id}`;
  const runs = new Map<string, RestateRunState>();

  const getRun = (runId: string): RestateRunState | undefined => runs.get(runId);

  const patchRun = (runId: string, patch: Partial<RestateRunState>): RestateRunState => {
    const existing = runs.get(runId) ?? ({ runId, status: 'running', events: [] } as RestateRunState);
    const next = { ...existing, ...patch };
    runs.set(runId, next);
    return next;
  };

  const recordEvents = (runId: string, events: RestateStreamEvent[]): void => {
    if (events.length === 0) {
      return;
    }
    const existing = runs.get(runId);
    runs.set(runId, {
      ...(existing ?? ({ runId, status: 'running', events: [] } as RestateRunState)),
      events: [...(existing?.events ?? []), ...events],
    });
  };

  const service = restate.service({
    name: serviceName,
    handlers: {
      /**
       * Execute an agent run durably. The invocation is journaled as a
       * Restate step; approval suspension uses a Restate awakeable.
       */
      run: async (ctx: restate.Context, request: RestateAgentRunRequest) => {
        const { runId, messages, options: wireOptions, resumeData } = request;
        if (!runId) {
          throw new TerminalError('runId is required');
        }

        const messages_ = serializeMessages(messages);
        const wire = wireOptions ?? {};
        const events: RestateStreamEvent[] = [];

        const execOptions: Record<string, unknown> = {
          ...wire,
          runId,
          onChunk: (chunk: ChunkType<any>) => {
            const safe = sanitizeChunk(chunk);
            if (safe) {
              events.push({ type: 'chunk', chunk: safe });
            }
          },
          onStepFinish: (step: unknown) => {
            events.push({ type: 'step-finish', step });
          },
          onSuspended: (data: unknown) => {
            events.push({ type: 'suspended', data });
          },
        };

        let awakeableId: string | undefined;
        if (wire.requireToolApproval) {
          const { id, promise } = ctx.awakeable<boolean>();
          awakeableId = id;
          patchRun(runId, { status: 'suspended', awakeableId });
          execOptions.requireToolApproval = async (toolCall: { toolCallId?: string; toolName?: string; args?: unknown }) => {
            patchRun(runId, { toolCall: toolCall ?? undefined });
            events.push({ type: 'suspended', data: { kind: 'awaiting-approval', toolCall } });
            return promise;
          };
        }

        patchRun(runId, { status: 'running' });
        try {
          const result = await ctx.run(
            resumeData ? 'agent-resume' : 'agent-run',
            async () => {
              const output = (resumeData
                ? await agent.resumeStream(resumeData, execOptions as any)
                : await agent.stream(messages_, execOptions as any)) as Awaited<
            ReturnType<Agent['stream']>
          >;

              const chunks: ChunkType[] = [];
              for await (const chunk of output.fullStream) {
                const safe = sanitizeChunk(chunk as ChunkType<any>) as ChunkType | undefined;
                if (safe) {
                  chunks.push(safe);
                }
              }

              const full = await output.getFullOutput();
              const modelInfo = (output as any).modelId ? { modelId: (output as any).modelId, provider: (output as any).provider } : {};
              return {
                text: full.text,
                chunks,
                steps: full.steps,
                usage: full.totalUsage ?? full.usage,
                finishReason: (full.finishReason ?? '') as string,
                suspendPayload: full.suspendPayload,
                warnings: full.warnings,
                ...modelInfo,
              } satisfies RestateAgentRunResult;
            },
            { maxRetryAttempts },
          );

          recordEvents(runId, events);
          patchRun(runId, { status: 'completed', result, toolCall: undefined, awakeableId: undefined });
          return { status: 'completed', runId, result };
        } catch (error) {
          recordEvents(runId, events);
          patchRun(runId, {
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            toolCall: undefined,
            awakeableId: undefined,
          });
          throw error;
        }
      },

      /**
       * Resolve an approval awakeable. Resuming the parked handler continues
       * the agent loop from the point of suspension.
       */
      resolveAwakeable: async (
        ctx: restate.Context,
        request: { awakeableId: string; resolution: RestateApprovalResolution },
      ) => {
        const { awakeableId, resolution } = request;
        if (!awakeableId) {
          throw new TerminalError('awakeableId is required');
        }
        ctx.resolveAwakeable(awakeableId, resolution.approved);
        return { ok: true };
      },

      /** Reject an approval awakeable, failing the parked run. */
      rejectAwakeable: async (ctx: restate.Context, request: { awakeableId: string; reason?: string }) => {
        const { awakeableId, reason } = request;
        if (!awakeableId) {
          throw new TerminalError('awakeableId is required');
        }
        ctx.rejectAwakeable(awakeableId, reason ?? 'Tool call rejected');
        return { ok: true };
      },

      /** Return the recorded state for a run (for `observe()` and approvals). */
      getRun: async (ctx: restate.Context, request: { runId: string }) => {
        const run = getRun(request.runId);
        return run ?? null;
      },
    },
  });

  return { service, serviceName, runs };
}

export { serializeOptions, serializeMessages };
