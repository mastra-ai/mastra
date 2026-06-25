import type { Session } from '../harness/session';
import type { HarnessEvent, HarnessMessage } from '../harness/types';
import { ChunkFrom } from '../stream/types';
import type { AgentChunkType } from '../stream/types';

import type { ChatChannelRenderContext } from './output-processor';
import { openRenderSession } from './render-pump';
import type { RenderSession } from './render-pump';

/**
 * Translates a Harness {@link Session}'s event stream into the
 * `AgentChunkType` chunks the existing channel drivers
 * (`runStreamingDriver` / `runStaticDriver`) already understand, then pumps
 * them through a shared render session (`openRenderSession`).
 *
 * This is the Harness-path peer of `ChatChannelOutputProcessor`: where the
 * agent path taps the agent's own output-processor chunk stream, the Harness
 * path consumes the **same contract the TUI consumes** — the Session event
 * bus — and reconstructs the minimal chunk shapes the drivers need. The
 * drivers, queue, and approval-card plumbing are reused verbatim; only the
 * *source* of the chunks differs.
 *
 * V1 scope: messaging + approvals. Mode/model events and OM/subagent events
 * are intentionally ignored — they don't map to a rendered channel output —
 * but the seam (subscribe → translate → push) doesn't preclude adding them.
 *
 * @internal
 */
export class SessionChannelRenderer {
  readonly #session: Session;
  readonly #render: ChatChannelRenderContext;
  readonly #runId: string;

  #renderSession: RenderSession | undefined;
  #unsubscribe: (() => void) | undefined;

  /**
   * Text already emitted to the driver for the in-flight assistant message,
   * keyed by message id. The Session emits the full evolving message text on
   * every `message_update`; the drivers want incremental `text-delta` pieces,
   * so we diff each update against what we've already pushed.
   */
  readonly #emittedText = new Map<string, string>();

  /** Resolves when the run reaches a terminal `agent_end` and the driver drains. */
  readonly #done: Promise<void>;
  #resolveDone!: () => void;

  constructor(args: { session: Session; render: ChatChannelRenderContext; runId?: string }) {
    this.#session = args.session;
    this.#render = args.render;
    // Channel drivers stamp `runId` onto nothing they render, but the chunk
    // contract requires it; a stable per-renderer id keeps every chunk in one
    // logical run.
    this.#runId = args.runId ?? `channel-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.#done = new Promise<void>(resolve => {
      this.#resolveDone = resolve;
    });
  }

  /**
   * Subscribe to the session and begin translating events. Returns a promise
   * that resolves once the run ends and the driver has drained the queue.
   */
  start(): Promise<void> {
    this.#unsubscribe = this.#session.subscribe(event => {
      this.#onEvent(event);
    });
    return this.#done;
  }

  #ensureRenderSession(): RenderSession {
    if (!this.#renderSession) {
      this.#renderSession = openRenderSession(this.#render);
    }
    return this.#renderSession;
  }

  #push(chunk: AgentChunkType<any>): void {
    this.#ensureRenderSession().queue.push(chunk);
  }

  #base() {
    return { runId: this.#runId, from: ChunkFrom.AGENT } as const;
  }

  #onEvent(event: HarnessEvent): void {
    switch (event.type) {
      case 'message_start':
      case 'message_update':
        this.#onMessage(event.message);
        return;
      case 'message_end':
        this.#onMessageEnd(event.message);
        return;
      case 'tool_start':
        this.#push({
          ...this.#base(),
          type: 'tool-call',
          payload: { toolCallId: event.toolCallId, toolName: event.toolName, args: event.args as any },
        });
        return;
      case 'tool_approval_required':
        // The drivers read `runId` off the approval chunk to stash it on the
        // pending-approval record (used to resume the right run later).
        this.#push({
          ...this.#base(),
          type: 'tool-call-approval',
          payload: {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: (event.args ?? {}) as Record<string, any>,
            resumeSchema: '',
          },
        });
        return;
      case 'tool_end':
        if (event.isError) {
          this.#push({
            ...this.#base(),
            type: 'tool-error',
            payload: {
              toolCallId: event.toolCallId,
              toolName: this.#toolNameFor(event.toolCallId),
              error: event.result,
            },
          });
        } else {
          this.#push({
            ...this.#base(),
            type: 'tool-result',
            payload: {
              toolCallId: event.toolCallId,
              toolName: this.#toolNameFor(event.toolCallId),
              result: event.result,
              isError: false,
              providerMetadata: event.providerMetadata as any,
            },
          });
        }
        return;
      case 'agent_end':
        this.#onAgentEnd(event.reason);
        return;
      default:
        // mode/model, OM, subagent, usage, info, task, goal, workspace, etc.
        // are not rendered to the channel in V1.
        return;
    }
  }

  /**
   * The Session models tool calls by id but `tool_end` carries no toolName.
   * Track the name from `tool_start` so we can rebuild `tool-result`/`tool-error`
   * payloads, which the drivers key on for channel-tool filtering and labels.
   */
  readonly #toolNames = new Map<string, string>();

  #toolNameFor(toolCallId: string): string {
    return this.#toolNames.get(toolCallId) ?? '';
  }

  #onMessage(message: HarnessMessage): void {
    if (message.role !== 'assistant') return;
    // Track tool names as they appear so later `tool_end` events can be labeled.
    for (const part of message.content) {
      if (part.type === 'tool_call') this.#toolNames.set(part.id, part.name);
    }
    const fullText = message.content
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('');
    if (!fullText) return;

    const already = this.#emittedText.get(message.id) ?? '';
    if (fullText === already) return;
    // Only emit forward progress; if the message text shrank (shouldn't happen
    // for an evolving assistant message), re-anchor without re-emitting.
    const delta = fullText.startsWith(already) ? fullText.slice(already.length) : fullText;
    this.#emittedText.set(message.id, fullText);
    if (!delta) return;
    this.#push({
      ...this.#base(),
      type: 'text-delta',
      payload: { id: message.id, text: delta },
    });
  }

  #onMessageEnd(message: HarnessMessage): void {
    if (message.role !== 'assistant') return;
    // Flush any remaining text first so the final piece renders.
    this.#onMessage(message);
    this.#push({ ...this.#base(), type: 'text-end', payload: { id: message.id } });
  }

  #onAgentEnd(reason: 'complete' | 'aborted' | 'error' | 'suspended' | undefined): void {
    // A suspended run is parked on an approval. The approval card has already
    // been posted by the driver (which closed its own internal render state on
    // the `tool-call-approval` chunk), so there's nothing more to render for
    // this run. Just drain the queue so the driver loop ends and `done`
    // resolves, letting the incoming-message handler return. No terminal chunk
    // is pushed — the driver already finalized its output. The eventual resume
    // run is rendered by a fresh renderer + render session keyed off the
    // resume action.
    if (reason === 'suspended') {
      void this.#finish();
      return;
    }

    if (reason === 'aborted') {
      this.#push({ ...this.#base(), type: 'abort', payload: {} });
    } else if (reason === 'error') {
      this.#push({
        ...this.#base(),
        type: 'error',
        payload: { error: new Error('Run failed') },
      });
    } else {
      this.#push({ ...this.#base(), type: 'finish', payload: {} as any });
    }
    void this.#finish();
  }

  async #finish(): Promise<void> {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    const rs = this.#renderSession;
    if (rs) {
      rs.queue.close();
      try {
        await rs.driverPromise;
      } catch (err) {
        this.#render.logger?.error?.(`[${this.#render.platform}] session channel render driver failed`, {
          error: err,
        });
      }
    }
    this.#renderSession = undefined;
    this.#resolveDone();
  }
}
