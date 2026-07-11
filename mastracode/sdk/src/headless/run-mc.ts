/**
 * Core programmatic runner for MastraCode headless runs.
 *
 * `runMC` is a pure async runner: it takes an already-built `controller` +
 * `session` (from `createMastraCode(...)`), resolves run config, subscribes to
 * the session, applies a {@link ResolutionPolicy} for approvals/suspensions,
 * sends the prompt, and aggregates events into a {@link RunMCResult}.
 *
 * It never touches `process.*` and never calls `process.exit`. The returned
 * {@link MCRun} is async-iterable over controller events and also resolves to a
 * final result via `result`.
 */
import type { AgentControllerEvent, AgentControllerMessage, Session } from '@mastra/core/agent-controller';

import { autoApprovePolicy } from './policy.js';
import type { MCRun, ResolutionPolicy, RunMCOptions, RunMCResult, RunMCStatus } from './types.js';

function extractAssistantText(message: AgentControllerMessage): string {
  return message.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('');
}

function exitCodeForStatus(status: RunMCStatus): number {
  switch (status) {
    case 'completed':
      return 0;
    case 'timeout':
      return 2;
    default:
      return 1;
  }
}

interface MutableResult {
  text: string;
  finishReason?: string;
  usage?: RunMCResult['usage'];
  toolCalls: RunMCResult['toolCalls'];
  toolResults: RunMCResult['toolResults'];
  error?: RunMCResult['error'];
  threadId?: string;
}

function aggregate(event: AgentControllerEvent, acc: MutableResult): void {
  switch (event.type) {
    case 'message_end':
      if (event.message.role === 'assistant') {
        acc.text += extractAssistantText(event.message);
      }
      break;
    case 'tool_start':
      acc.toolCalls.push({ id: event.toolCallId, name: event.toolName, args: event.args });
      break;
    case 'tool_end': {
      const matching = acc.toolCalls.find(c => c.id === event.toolCallId);
      acc.toolResults.push({
        id: event.toolCallId,
        name: matching?.name ?? '',
        result: event.result,
        isError: event.isError,
      });
      break;
    }
    case 'usage_update':
      acc.usage = {
        inputTokens: event.usage.promptTokens,
        outputTokens: event.usage.completionTokens,
        totalTokens: event.usage.totalTokens,
      };
      break;
    case 'error':
      acc.error = {
        name: event.error.name,
        message: event.error.message,
        stack: event.error.stack,
      };
      break;
  }
}

/** Resolve a thread by its exact ID. Titles are not unique, so we don't match on them. */
async function resolveThread<TState extends Record<string, unknown>>(
  session: Session<TState>,
  threadId: string,
): Promise<{ threadId: string } | { error: string }> {
  const threads = await session.thread.list();

  const byId = threads.find(t => t.id === threadId);
  if (byId) return { threadId: byId.id };

  return { error: `No thread found with ID "${threadId}"` };
}

/**
 * A simple back-pressured async queue. Events are pushed in; consumers pull via
 * the async iterator. `close()` ends iteration after draining buffered events.
 *
 * Buffered events are bounded by `maxBuffer`: if a consumer never iterates (the
 * result-only path, `await run.result` without `for await (...)`) — or simply
 * falls far behind — the oldest buffered events are dropped instead of growing
 * without limit. The aggregated {@link RunMCResult} is built independently of
 * this queue, so dropping buffered events never affects the final result.
 */
class EventQueue<T> {
  #buffer: T[] = [];
  #resolvers: Array<(r: IteratorResult<T>) => void> = [];
  #closed = false;
  readonly #maxBuffer: number;

  constructor(maxBuffer = 10_000) {
    this.#maxBuffer = maxBuffer;
  }

  push(value: T): void {
    if (this.#closed) return;
    const resolve = this.#resolvers.shift();
    if (resolve) {
      resolve({ value, done: false });
      return;
    }
    this.#buffer.push(value);
    if (this.#buffer.length > this.#maxBuffer) {
      // Bound memory: drop the oldest event once over the cap.
      this.#buffer.shift();
    }
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    for (const resolve of this.#resolvers.splice(0)) {
      resolve({ value: undefined as unknown as T, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        if (this.#buffer.length > 0) {
          return Promise.resolve({ value: this.#buffer.shift()!, done: false });
        }
        if (this.#closed) {
          return Promise.resolve({ value: undefined as unknown as T, done: true });
        }
        return new Promise<IteratorResult<T>>(resolve => this.#resolvers.push(resolve));
      },
    };
  }
}

/**
 * Run a headless MastraCode turn. Returns an {@link MCRun} handle that is
 * async-iterable over controller events and resolves to a {@link RunMCResult}.
 */
export function runMC<TState extends Record<string, unknown>>(options: RunMCOptions<TState>): MCRun {
  const { controller, session, prompt } = options;
  const policy: ResolutionPolicy = options.policy ?? autoApprovePolicy;

  const queue = new EventQueue<AgentControllerEvent>();
  const acc: MutableResult = { text: '', toolCalls: [], toolResults: [] };

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  let aborted = false;
  let maxTurnsExceeded = false;
  let assistantTurns = 0;
  let settled = false;
  let unsubscribe: (() => void) | undefined;
  let resolveResult!: (r: RunMCResult) => void;

  const result = new Promise<RunMCResult>(resolve => {
    resolveResult = resolve;
  });

  function finish(status: RunMCStatus): void {
    if (settled) return;
    settled = true;
    if (timeoutId) clearTimeout(timeoutId);
    unsubscribe?.();
    queue.close();
    resolveResult({
      status,
      text: acc.text,
      finishReason: acc.finishReason,
      usage: acc.usage,
      toolCalls: acc.toolCalls,
      toolResults: acc.toolResults,
      threadId: acc.threadId ?? session.thread.getId() ?? undefined,
      error: acc.error,
      exitCode: exitCodeForStatus(status),
    });
  }

  function fail(message: string, name = 'Error'): void {
    if (!acc.error) acc.error = { name, message };
    finish('error');
  }

  function abort(): void {
    if (settled) return;
    aborted = true;
    session.abort();
  }

  if (options.signal) {
    if (options.signal.aborted) {
      // Defer so the caller can attach iteration / result handlers first.
      queueMicrotask(() => abort());
    } else {
      options.signal.addEventListener('abort', () => abort(), { once: true });
    }
  }

  // Kick off the run asynchronously so the MCRun handle is returned synchronously.
  void (async () => {
    if (options.timeoutMs) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        session.abort();
      }, options.timeoutMs);
    }

    // --- Config resolution (model / mode / thinking) ---
    try {
      if (options.model) {
        const available = await controller.listAvailableModels();
        const match = available.find(m => m.id === options.model);
        if (!match) return fail(`Unknown model: "${options.model}"`);
        if (!match.hasApiKey) {
          const keyHint = match.apiKeyEnvVar ? ` Set ${match.apiKeyEnvVar} to use this model.` : '';
          return fail(`Model "${options.model}" has no API key configured.${keyHint}`);
        }
        await session.model.switch({ modelId: options.model });
      } else if (options.mode) {
        const modelId = options.modeDefaults?.[options.mode];
        if (modelId) {
          const available = await controller.listAvailableModels();
          const match = available.find(m => m.id === modelId);
          if (!match) return fail(`Unknown model "${modelId}" configured for mode "${options.mode}"`);
          if (!match.hasApiKey) {
            const keyHint = match.apiKeyEnvVar ? ` Set ${match.apiKeyEnvVar} to use this model.` : '';
            return fail(`Model "${modelId}" (mode: ${options.mode}) has no API key configured.${keyHint}`);
          }
          await session.model.switch({ modelId });
        }
        // No configured model for mode → fall through to default (no failure).
      }

      if (options.thinkingLevel) {
        await session.state.set({ thinkingLevel: options.thinkingLevel } as unknown as Partial<TState>);
      }
    } catch (err) {
      return fail(`Failed to resolve run config: ${(err as Error).message}`);
    }

    // --- Subscribe ---
    unsubscribe = session.subscribe(event => {
      if (settled) return;

      if (event.type === 'tool_approval_required') {
        let decision: 'approve' | 'deny';
        try {
          decision = policy.onToolApproval(event);
        } catch (err) {
          fail(`Resolution policy failed: ${(err as Error).message}`);
          return;
        }
        session.respondToToolApproval({
          decision: decision === 'approve' ? 'approve' : 'decline',
          toolCallId: event.toolCallId,
        });
        queue.push(event);
        return;
      }

      if (event.type === 'tool_suspended') {
        let outcome: ReturnType<ResolutionPolicy['onSuspension']>;
        try {
          outcome = policy.onSuspension(event);
        } catch (err) {
          fail(`Resolution policy failed: ${(err as Error).message}`);
          return;
        }
        if ('abort' in outcome) {
          queue.push(event);
          abort();
          return;
        }
        void session.respondToToolSuspension({ toolCallId: event.toolCallId, resumeData: outcome.resumeData });
        queue.push(event);
        return;
      }

      aggregate(event, acc);
      queue.push(event);

      // Count agentic turns (one assistant response = one turn). When the cap is
      // reached, abort the run; agent_end then resolves as 'max_turns'.
      if (event.type === 'message_end' && event.message.role === 'assistant' && options.maxTurns !== undefined) {
        assistantTurns += 1;
        if (assistantTurns >= options.maxTurns && !maxTurnsExceeded) {
          maxTurnsExceeded = true;
          abort();
        }
      }

      if (event.type === 'agent_end') {
        acc.finishReason = event.reason;
        if (timedOut) {
          finish('timeout');
        } else if (event.reason === 'error') {
          finish('error');
        } else if (maxTurnsExceeded && event.reason !== 'complete') {
          // The cap forced an abort while the agent still had work to do.
          finish('max_turns');
        } else if ((event.reason === 'aborted' || aborted) && !maxTurnsExceeded) {
          finish('aborted');
        } else {
          finish('completed');
        }
      }
    });

    // --- Resource id ---
    try {
      if (options.resourceId) {
        await controller.setResourceId(session, { resourceId: options.resourceId });
      }
    } catch (err) {
      return fail(`Failed to set resource id: ${(err as Error).message}`);
    }

    // --- Thread selection ---
    try {
      const thread = options.thread;
      if (thread?.id) {
        const resolved = await resolveThread(session, thread.id);
        if ('error' in resolved) return fail(resolved.error);
        await session.thread.switch({ threadId: resolved.threadId });
      } else if (thread?.continueLatest) {
        const threads = await session.thread.list();
        if (threads.length > 0) {
          const sorted = [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
          await session.thread.switch({ threadId: sorted[0]!.id });
        }
      }
    } catch (err) {
      return fail(`Failed to select thread: ${(err as Error).message}`);
    }

    // --- Clone ---
    if (options.thread?.clone) {
      try {
        await session.thread.clone();
      } catch (err) {
        return fail(`Failed to clone thread: ${(err as Error).message}`);
      }
    }

    // --- Title ---
    if (options.title) {
      try {
        await session.thread.rename({ title: options.title });
      } catch (err) {
        return fail(`Failed to set thread title: ${(err as Error).message}`);
      }
    }

    // --- Send ---
    try {
      await session.sendMessage({ content: prompt });
    } catch (err) {
      return fail(`Failed to send message: ${(err as Error).message}`);
    }
  })();

  return {
    result,
    abort,
    [Symbol.asyncIterator](): AsyncIterator<AgentControllerEvent> {
      return queue[Symbol.asyncIterator]();
    },
  };
}
