import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent-controller';
export type { MastraDBMessage, MastraMessageContentV2, MastraMessagePart } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import type { ClientOptions } from '../types';
import { parseClientRequestContext } from '../utils';
import { BaseResource } from './base';

/**
 * Agent controller session client.
 *
 * Mirrors the controller HTTP routes served when an AgentController is
 * registered on a Mastra instance (`new Mastra({ agentControllers })`). The
 * routes are served under `/agent-controller`:
 *
 *   GET  /agent-controller                                          listAgentControllers
 *   POST /agent-controller/:id/sessions                             session().create()
 *   GET  /agent-controller/:id/sessions/:resourceId/stream          session().subscribe()
 *   POST /agent-controller/:id/sessions/:resourceId/messages        session().sendMessage()
 *   POST /agent-controller/:id/sessions/:resourceId/abort           session().abort()
 *   POST /agent-controller/:id/sessions/:resourceId/tool-approval   session().approveTool()
 */

export interface AgentControllerInfo {
  id: string;
}

/**
 * Status-line relevant slice of observational-memory progress, mirroring the
 * TUI status line. `msg` reads `pendingTokens/threshold ↓projectedMessageRemoval`
 * (the active message window before an observation fires); `mem` reads
 * `observationTokens/reflectionThreshold ↓projectedReflectionSavings`
 * (accumulated observations before a reflection fires).
 */
export interface AgentControllerOMProgress {
  status: string;
  pendingTokens: number;
  threshold: number;
  thresholdPercent: number;
  observationTokens: number;
  reflectionThreshold: number;
  reflectionThresholdPercent: number;
  projectedMessageRemoval: number;
  projectedReflectionSavings: number;
}

/**
 * AgentController events the SDK types explicitly. This is a discriminated union, so
 * narrowing on `event.type` gives you the right payload fields. This mirrors the
 * subset of the agent controller event stream a web client typically renders.
 */
export type KnownAgentControllerEvent =
  | { type: 'agent_start' }
  | { type: 'agent_end'; reason?: 'complete' | 'aborted' | 'error' | 'suspended' }
  // Assistant message streaming.
  | { type: 'message_start'; message: MastraDBMessage }
  | { type: 'message_update'; message: MastraDBMessage }
  | { type: 'message_end'; message: MastraDBMessage }
  // Tool lifecycle.
  | { type: 'tool_input_start'; toolCallId: string; toolName: string }
  | { type: 'tool_input_delta'; toolCallId: string; argsTextDelta: string; toolName?: string }
  | { type: 'tool_input_end'; toolCallId: string }
  | { type: 'tool_start'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool_update'; toolCallId: string; partialResult: unknown }
  | { type: 'shell_output'; toolCallId: string; output: string; stream: 'stdout' | 'stderr' }
  | { type: 'tool_end'; toolCallId: string; result?: unknown; isError?: boolean }
  // Interactive prompts.
  | { type: 'tool_approval_required'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool_suspended'; toolCallId: string; toolName: string; args: unknown; suspendPayload: unknown }
  // Session state changes.
  | { type: 'mode_changed'; modeId: string; previousModeId: string }
  | { type: 'model_changed'; modelId: string; scope?: 'global' | 'thread' | 'mode'; modeId?: string }
  | { type: 'thread_changed'; threadId: string; previousThreadId: string | null }
  | { type: 'thread_created'; thread: { id: string; title?: string } }
  | { type: 'thread_deleted'; threadId: string }
  // Subagents.
  | { type: 'subagent_start'; toolCallId: string; agentType: string; task: string; modelId: string }
  | { type: 'subagent_end'; toolCallId: string }
  // Task tools.
  | { type: 'task_updated'; tasks: AgentControllerTaskSnapshot[] }
  // Notifications.
  | {
      type: 'notification';
      notificationId?: string;
      message: string;
      source?: string;
      kind?: string;
      priority?: string;
      status?: string;
      attributes?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'notification_summary';
      message: string;
      pending: number;
      bySource: Record<string, number>;
      byPriority: Record<string, number>;
      notificationIds: string[];
    }
  // Usage tracking.
  | { type: 'usage_update'; usage: unknown }
  // Canonical display-state snapshot, emitted after every other event. Carries
  // the status-line figures (OM progress + cumulative token usage). Maps/Dates
  // in the full display state don't survive JSON, so only plain fields are typed.
  | {
      type: 'display_state_changed';
      displayState: {
        isRunning?: boolean;
        omProgress?: AgentControllerOMProgress;
        tokenUsage?: Record<string, unknown>;
        [key: string]: unknown;
      };
    }
  // Goals.
  | {
      type: 'goal_evaluation';
      payload: {
        objective: string;
        iteration: number;
        maxRuns: number;
        passed: boolean;
        status: 'active' | 'paused' | 'done';
        reason?: string;
      };
    }
  // Follow-up queue.
  | { type: 'follow_up_queued'; count: number }
  // Observational memory lifecycle.
  | { type: 'om_observation_start' }
  | { type: 'om_observation_end' }
  | { type: 'om_observation_failed'; error?: string }
  | { type: 'om_reflection_start' }
  | { type: 'om_reflection_end' }
  | { type: 'om_reflection_failed'; error?: string }
  | { type: 'om_buffering_start' }
  | { type: 'om_buffering_end' }
  | { type: 'om_buffering_failed'; error?: string }
  | { type: 'om_model_changed'; role: string; modelId: string }
  | { type: 'om_activation'; enabled: boolean }
  | { type: 'om_status'; status: string }
  | { type: 'om_thread_title_updated'; title: string }
  // Workspace lifecycle.
  | { type: 'workspace_ready' }
  | { type: 'workspace_error'; error?: string }
  | { type: 'workspace_status_changed'; status: string }
  // Notices.
  | { type: 'info'; message: string }
  | { type: 'error'; error: { message?: string } | string; errorType?: string };

/** Any other agent controller event the SDK doesn't model explicitly. */
export interface OtherAgentControllerEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * An agent controller event. Narrow on `type` to access known payloads; unknown
 * event types fall through to {@link OtherAgentControllerEvent}.
 */
export type AgentControllerEvent = KnownAgentControllerEvent | OtherAgentControllerEvent;

type SerializedMastraDBMessage = Omit<MastraDBMessage, 'createdAt'> & { createdAt: Date | string };

function hydrateMessage(message: SerializedMastraDBMessage): MastraDBMessage {
  return {
    ...message,
    createdAt: message.createdAt instanceof Date ? message.createdAt : new Date(message.createdAt),
  };
}

function hydrateEventMessage(event: AgentControllerEvent): AgentControllerEvent {
  if (event.type !== 'message_start' && event.type !== 'message_update' && event.type !== 'message_end') return event;

  return {
    ...event,
    message: hydrateMessage(event.message as SerializedMastraDBMessage),
  } as AgentControllerEvent;
}

/** Response from creating or resuming an agent controller session. */
export interface CreateAgentControllerSessionResponse {
  controllerId: string;
  resourceId: string;
  threadId?: string;
}

/** Agent behavior settings, mirroring the TUI's `/settings` toggles. */
export interface AgentControllerSessionSettings {
  /** Auto-approve all tool calls (no per-tool prompt). */
  yolo: boolean;
  /** Extended-thinking budget. */
  thinkingLevel: 'off' | 'low' | 'medium' | 'high' | 'xhigh';
  /** How completion/notification alerts are delivered. */
  notifications: 'off' | 'bell' | 'system' | 'both';
  /** Use AST-aware smart editing when available. */
  smartEditing: boolean;
}

/** State snapshot for an agent controller session. */
export interface AgentControllerSessionState {
  controllerId: string;
  resourceId: string;
  threadId?: string;
  modeId: string;
  modelId: string;
  /** Whether the agent is currently executing a run (for initial UI hydration). */
  running?: boolean;
  /** OM progress snapshot for the status line (initial hydration). */
  omProgress?: AgentControllerOMProgress;
  /** Cumulative token usage for the current thread. */
  tokenUsage?: Record<string, unknown>;
  /** Agent behavior settings (yolo, thinking, notifications, smart editing). */
  settings?: AgentControllerSessionSettings;
}

export interface AgentControllerModeInfo {
  id: string;
  name?: string;
}

export interface AgentControllerThreadInfo {
  id: string;
  title?: string;
  resourceId?: string;
  createdAt?: string;
  updatedAt?: string;
  /**
   * The session scoping tags this thread was stamped with at creation (e.g.
   * `{ projectPath }`). Present on `listThreads()` results; used to tell which
   * worktree/scope a thread belongs to when a resourceId is shared.
   */
  tags?: Record<string, string>;
  /**
   * Whether a run is currently executing on this thread (`'active'`) or not
   * (`'idle'`). Present on `listThreads()` results; lets one listing report
   * activity across every worktree/scope sharing the resourceId.
   */
  state?: 'active' | 'idle';
}

export interface AgentControllerAvailableModel {
  id: string;
  provider: string;
  modelName: string;
  hasApiKey: boolean;
  apiKeyEnvVar?: string;
  useCount: number;
}

export interface AgentControllerWorkspaceStatus {
  hasWorkspace: boolean;
  isReady: boolean;
}

export interface AgentControllerGoalRecord {
  id?: string;
  objective: string;
  status: 'active' | 'paused' | 'done';
  runsUsed: number;
  maxRuns?: number;
  judgeModelId?: string;
  startedAt: number;
  updatedAt: number;
  pausedReason?: string;
}

/** Permission policy for a tool or category. */
export type PermissionPolicy = 'allow' | 'ask' | 'deny';

/** Tool category for permission grouping. */
export type ToolCategory = 'read' | 'edit' | 'execute' | 'mcp' | 'other';

/** Permission rules for controlling tool approval behavior. */
export interface PermissionRules {
  categories?: Partial<Record<ToolCategory, PermissionPolicy>>;
  tools?: Partial<Record<string, PermissionPolicy>>;
}

/** Snapshot of a single task item from the task tools. */
export interface AgentControllerTaskSnapshot {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

/** Input for sending a notification signal to a session. */
export interface SendNotificationInput {
  source: string;
  kind: string;
  summary: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  payload?: unknown;
  sourceId?: string;
  dedupeKey?: string;
  coalesceKey?: string;
  attributes?: Record<string, string | number | boolean | null | undefined>;
  metadata?: Record<string, unknown>;
}

/** Result of sending a notification signal. */
export interface SendNotificationResult {
  accepted: boolean;
  notificationId?: string;
  /** Delivery decision: deliver, queue, defer, summarize, persist, or discard. */
  decision?: string;
  runId?: string;
}

/** Resume payload for the built-in `submit_plan` suspension. */
export interface PlanResume {
  action: 'approved' | 'rejected';
  feedback?: string;
}

/**
 * Options accepted by session methods that trigger or resume agent execution.
 * The `requestContext` is merged into the server-derived request context for
 * that run (server-controlled keys win), so it reaches dynamic instructions,
 * tools, and workspace resolution — mirroring `agent.generate()`.
 */
export interface AgentControllerRequestOptions {
  requestContext?: RequestContext | Record<string, any>;
}

/** Options for user-authored session messages. */
export interface AgentControllerMessageOptions extends AgentControllerRequestOptions {
  attributes?: Record<string, string | number | boolean | null | undefined>;
}

/** Options for subscribing to an agent controller session's event stream. */
export interface SubscribeAgentControllerSessionOptions {
  /** Called for each event received over the stream. */
  onEvent: (event: AgentControllerEvent) => void;
  /**
   * Called when the stream errors or ends and no (further) reconnect will be
   * attempted — the subscription is dead after this fires.
   */
  onError?: (error: unknown) => void;
  /**
   * Called each time the stream is re-established after a drop (reconnect
   * only). The server does NOT replay events missed while disconnected, so
   * stateful consumers MUST re-sync from here (e.g. `session.state()`) or
   * they will silently lose the gap.
   */
  onReconnect?: () => void;
  /**
   * Automatically re-establish the stream after an established stream drops
   * (clean close or transport error). Does not apply to the initial
   * connection — `subscribe()` rejects if it can't connect. Retries back off
   * exponentially from `delayMs` (default 1s) up to `maxDelayMs` (default
   * 30s); `maxRetries` (default Infinity) bounds the attempts per outage —
   * the counter resets once a connection is re-established. When retries are
   * exhausted, `onError` fires.
   */
  reconnect?:
    | boolean
    | {
        maxRetries?: number;
        delayMs?: number;
        maxDelayMs?: number;
      };
}

export interface AgentControllerSubscription {
  /** Stop reading and release the underlying stream. */
  unsubscribe: () => void;
}

/**
 * A session bound to a `resourceId` within one agent controller. Sessions are
 * get-or-create on the server, so re-creating the same resourceId (and scope)
 * resumes the existing conversation rather than forking it.
 *
 * Pass a `scope` to address an independent session over the same resourceId:
 * two sessions with the same resourceId but different scopes have their own
 * run loop, thread binding, and mode/model/state (e.g. one session per git
 * worktree, with the worktree path as the scope). The scope travels on every
 * request as a `sessionScope` query param.
 */
export class AgentControllerSession extends BaseResource {
  constructor(
    options: ClientOptions,
    private readonly controllerId: string,
    private readonly resourceId: string,
    private readonly scope?: string,
  ) {
    super(options);
  }

  private base() {
    return `/agent-controller/${encodeURIComponent(this.controllerId)}/sessions/${encodeURIComponent(this.resourceId)}`;
  }

  /** Append this session's scope (if any) as a `sessionScope` query param. */
  private url(path: string): string {
    if (this.scope === undefined) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}sessionScope=${encodeURIComponent(this.scope)}`;
  }

  /**
   * Create or resume this session. Pass `tags` to scope initial thread
   * selection — a thread is a resume candidate only when its metadata matches
   * every tag. Pass `threadId` to bind the session to one exact thread,
   * creating it with that id when it does not exist.
   */
  create(options?: {
    tags?: Record<string, string>;
    threadId?: string;
  }): Promise<CreateAgentControllerSessionResponse> {
    return this.request(`/agent-controller/${encodeURIComponent(this.controllerId)}/sessions`, {
      method: 'POST',
      body: {
        resourceId: this.resourceId,
        tags: options?.tags,
        threadId: options?.threadId,
        sessionScope: this.scope,
      },
    });
  }

  /**
   * Subscribe to this session's event stream (SSE). The assistant's reply to a
   * message arrives here as `message_*` events, not on the sendMessage call.
   *
   * The returned promise resolves once the stream is actually established and
   * rejects when it cannot be. A rejected subscribe leaves nothing running —
   * `reconnect` governs only re-establishment after an established stream
   * drops, so callers that want connect-time retry can loop around
   * `subscribe()` themselves and keep cancellation control.
   */
  async subscribe(options: SubscribeAgentControllerSessionOptions): Promise<AgentControllerSubscription> {
    // Normalize reconnect knobs defensively: NaN/negative delays would produce
    // zero-delay timers and a NaN retry cap would never exhaust (`n >= NaN` is
    // always false), turning an outage into a hot retry loop.
    const finiteOr = (value: number | undefined, fallback: number) =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
    const retriesOr = (value: number | undefined, fallback: number) =>
      value === Infinity || (typeof value === 'number' && Number.isFinite(value) && value >= 0) ? value : fallback;
    const reconnectOptions =
      options.reconnect === true
        ? { maxRetries: Infinity, delayMs: 1000, maxDelayMs: 30_000 }
        : options.reconnect
          ? {
              maxRetries: retriesOr(options.reconnect.maxRetries, Infinity),
              delayMs: finiteOr(options.reconnect.delayMs, 1000),
              maxDelayMs: finiteOr(options.reconnect.maxDelayMs, 30_000),
            }
          : null;

    /** Exponential backoff for the Nth (1-based) retry of an outage streak. */
    const backoffDelay = (attempt: number) =>
      reconnectOptions ? Math.min(reconnectOptions.delayMs * 2 ** (attempt - 1), reconnectOptions.maxDelayMs) : 0;

    let cancelled = false;
    let currentReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let delayResolve: (() => void) | undefined;

    const settleDelay = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }
      const resolve = delayResolve;
      delayResolve = undefined;
      resolve?.();
    };

    const delay = (ms: number) =>
      new Promise<void>(resolve => {
        delayResolve = resolve;
        reconnectTimer = setTimeout(settleDelay, ms);
      });

    const requestStream = async (): Promise<Response> => {
      const response = (await this.request(this.url(`${this.base()}/stream`), { stream: true })) as Response;
      if (!response.body) {
        throw new Error('No response body for agent controller session stream');
      }
      return response;
    };

    const streamEndedError = () => new Error('Agent controller session stream ended unexpectedly');

    const findFrameSeparator = (text: string): { index: number; length: number } | null => {
      const candidates = [
        { index: text.indexOf('\r\n\r\n'), length: 4 },
        { index: text.indexOf('\n\n'), length: 2 },
        { index: text.indexOf('\r\r'), length: 2 },
      ].filter(candidate => candidate.index !== -1);
      if (candidates.length === 0) return null;
      return candidates.reduce((earliest, candidate) => (candidate.index < earliest.index ? candidate : earliest));
    };

    type PumpResult =
      | { kind: 'done' }
      | { kind: 'cancelled' }
      | { kind: 'consumer_error' }
      | { kind: 'transport_error'; error: unknown };

    const pump = async (response: Response): Promise<PumpResult> => {
      const reader = response.body!.getReader();
      currentReader = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) return cancelled ? { kind: 'cancelled' } : { kind: 'done' };
          buffer += decoder.decode(value, { stream: true });

          let separator: { index: number; length: number } | null;
          while ((separator = findFrameSeparator(buffer)) !== null) {
            const frame = buffer.slice(0, separator.index);
            buffer = buffer.slice(separator.index + separator.length);
            for (const line of frame.split(/\r\n|\n|\r/)) {
              if (!line.startsWith('data:')) continue;
              const data = line.slice(5).trim();
              if (!data) continue;
              let event: AgentControllerEvent;
              try {
                event = hydrateEventMessage(JSON.parse(data) as AgentControllerEvent);
              } catch {
                continue;
              }
              try {
                options.onEvent(event);
              } catch (cause) {
                if (!cancelled) safeOnError(cause);
                return { kind: 'consumer_error' };
              }
            }
          }
        }
        return { kind: 'cancelled' };
      } catch (error) {
        return cancelled ? { kind: 'cancelled' } : { kind: 'transport_error', error };
      } finally {
        if (currentReader === reader) currentReader = null;
        void reader.cancel().catch(() => {});
      }
    };

    // Consumer callbacks run inside the detached stream loop (`void run(...)`),
    // so a throwing onError would surface as an unhandled promise rejection —
    // and, thrown from inside pump(), would be misread as a transport error.
    const safeOnError = (error: unknown) => {
      try {
        options.onError?.(error);
      } catch {
        // Consumer callback failures must not kill (or reroute) the stream loop.
      }
    };

    const reportTerminalError = (result: Extract<PumpResult, { kind: 'done' } | { kind: 'transport_error' }>) => {
      safeOnError(result.kind === 'transport_error' ? result.error : streamEndedError());
    };

    /** Pump one established stream, mapping unexpected throws to transport errors. */
    const pumpSafe = async (response: Response): Promise<PumpResult> => {
      try {
        return await pump(response);
      } catch (error) {
        return cancelled ? { kind: 'cancelled' } : { kind: 'transport_error', error };
      }
    };

    // Establish the FIRST stream before resolving so callers can trust that a
    // resolved subscribe() means events are flowing, and a rejected one means
    // nothing is running in the background. Reconnect deliberately does not
    // apply here: retrying before a subscription handle exists would leave the
    // caller with no way to cancel the loop (e.g. reconnect: true would hang
    // forever against a down server).
    const firstResponse = await requestStream();

    // Background loop: pump the current stream; on drop, re-establish it under
    // the reconnect policy (exponential backoff, per-outage retry budget) and
    // notify the consumer via onReconnect so it can re-sync missed state.
    const run = async (initial: Response) => {
      let response = initial;

      while (!cancelled) {
        let result = await pumpSafe(response);

        if (cancelled || result.kind === 'cancelled' || result.kind === 'consumer_error') return;

        // result is 'done' or 'transport_error' — the stream dropped.
        if (!reconnectOptions) {
          reportTerminalError(result);
          return;
        }

        // Retry until a new stream is established or the budget is exhausted.
        let attempts = 0;
        let reconnectedResponse: Response | undefined;
        while (!reconnectedResponse) {
          if (attempts >= reconnectOptions.maxRetries) {
            reportTerminalError(result);
            return;
          }
          attempts++;
          await delay(backoffDelay(attempts));
          if (cancelled) return;
          try {
            reconnectedResponse = await requestStream();
          } catch (error) {
            result = { kind: 'transport_error', error };
          }
        }

        if (cancelled) {
          void reconnectedResponse.body?.cancel().catch(() => {});
          return;
        }

        response = reconnectedResponse;
        try {
          options.onReconnect?.();
        } catch {
          // Consumer callback failures must not kill the stream loop.
        }
      }
    };

    void run(firstResponse);

    return {
      unsubscribe: () => {
        cancelled = true;
        settleDelay();
        void currentReader?.cancel().catch(() => {});
      },
    };
  }

  /**
   * Send a user message. The reply streams over `subscribe()`.
   * Pass a structured message to attach files (e.g. pasted images) as base64-encoded data:
   * `sendMessage({ content: 'What is in this image?', files })`.
   * Pass `options.requestContext` to merge custom context into the run's request context.
   */
  async sendMessage(
    message: string | { content: string; files?: Array<{ data: string; mediaType: string; filename?: string }> },
    options?: AgentControllerMessageOptions,
  ): Promise<void> {
    const { content, files } = typeof message === 'string' ? { content: message, files: undefined } : message;
    const requestContext = parseClientRequestContext(options?.requestContext);
    await this.request(this.url(`${this.base()}/messages`), {
      method: 'POST',
      body: {
        message: content,
        ...(files?.length ? { files } : {}),
        ...(options?.attributes ? { attributes: options.attributes } : {}),
        ...(requestContext ? { requestContext } : {}),
      },
    });
  }

  /** Abort the in-flight run for this session. */
  async abort(): Promise<void> {
    await this.request(this.url(`${this.base()}/abort`), { method: 'POST' });
  }

  /** Approve or decline a pending tool call (`tool_approval_required`). */
  async approveTool(toolCallId: string, approved: boolean, options?: AgentControllerRequestOptions): Promise<void> {
    const requestContext = parseClientRequestContext(options?.requestContext);
    await this.request(this.url(`${this.base()}/tool-approval`), {
      method: 'POST',
      body: { toolCallId, approved, ...(requestContext ? { requestContext } : {}) },
    });
  }

  /**
   * Resume a suspended interactive tool (`tool_suspended`). The resume shape
   * depends on the tool: a string (or string[]) for `ask_user`, "Yes"/"No" for
   * `request_access`, and a {@link PlanResume} for `submit_plan`.
   */
  async respondToToolSuspension(
    toolCallId: string,
    resumeData: string | string[] | PlanResume,
    options?: AgentControllerRequestOptions,
  ): Promise<void> {
    const requestContext = parseClientRequestContext(options?.requestContext);
    await this.request(this.url(`${this.base()}/tool-suspension`), {
      method: 'POST',
      body: { toolCallId, resumeData, ...(requestContext ? { requestContext } : {}) },
    });
  }

  /** Inject a message into the in-flight run without starting a new turn. */
  async steer(message: string, options?: AgentControllerMessageOptions): Promise<void> {
    const requestContext = parseClientRequestContext(options?.requestContext);
    await this.request(this.url(`${this.base()}/steer`), {
      method: 'POST',
      body: {
        message,
        ...(options?.attributes ? { attributes: options.attributes } : {}),
        ...(requestContext ? { requestContext } : {}),
      },
    });
  }

  /** Get the current mode, model, and thread (for initial UI hydration). */
  state(): Promise<AgentControllerSessionState> {
    return this.request(this.url(this.base()));
  }

  /** Merge key-value pairs into the session state. Existing keys not in the payload are preserved. */
  async setState(updates: Record<string, unknown>): Promise<void> {
    await this.request(this.url(`${this.base()}/state`), { method: 'PUT', body: { state: updates } });
  }

  /** Switch the active mode (e.g. `build`, `plan`). */
  async switchMode(modeId: string): Promise<void> {
    await this.request(this.url(`${this.base()}/mode`), { method: 'POST', body: { modeId } });
  }

  /** Switch the model. Defaults to thread scope. */
  async switchModel(modelId: string, options?: { scope?: 'global' | 'thread'; modeId?: string }): Promise<void> {
    await this.request(this.url(`${this.base()}/model`), {
      method: 'POST',
      body: { modelId, scope: options?.scope, modeId: options?.modeId },
    });
  }

  /**
   * List the session's threads, newest first. Pass `limit` to cap the count
   * (e.g. for a sidebar) and `tags` to scope to threads matching every tag —
   * necessary when one resourceId is shared across git worktrees of the same
   * repo (e.g. `{ tags: { projectPath } }` so each worktree sees only its own
   * threads). Passing a bare number is shorthand for `{ limit }`.
   */
  async listThreads(
    options?: number | { limit?: number; tags?: Record<string, string> },
  ): Promise<AgentControllerThreadInfo[]> {
    const opts = typeof options === 'number' ? { limit: options } : (options ?? {});
    const params = new URLSearchParams();
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.tags && Object.keys(opts.tags).length > 0) params.set('tags', JSON.stringify(opts.tags));
    const query = params.toString() ? `?${params.toString()}` : '';
    const body = await this.request<{ threads: AgentControllerThreadInfo[] }>(
      this.url(`${this.base()}/threads${query}`),
    );
    return body.threads;
  }

  /** Switch the session to an existing thread (rebinds stream + state). */
  async switchThread(threadId: string): Promise<void> {
    await this.request(this.url(`${this.base()}/thread`), { method: 'POST', body: { threadId } });
  }

  /** Create a new thread (unbinds previous, binds the new one). */
  async createThread(title?: string): Promise<AgentControllerThreadInfo> {
    return this.request(this.url(`${this.base()}/threads`), {
      method: 'POST',
      body: { title },
    });
  }

  /** Delete a thread. If it's the active thread the session unbinds. */
  async deleteThread(threadId: string): Promise<void> {
    await this.request(this.url(`${this.base()}/threads/${encodeURIComponent(threadId)}`), {
      method: 'DELETE',
    });
  }

  /** Rename a thread. */
  async renameThread(threadId: string, title: string): Promise<void> {
    await this.request(this.url(`${this.base()}/threads/${encodeURIComponent(threadId)}`), {
      method: 'PUT',
      body: { title },
    });
  }

  /** Clone a thread (and its messages). The session binds to the clone. */
  async cloneThread(options?: { sourceThreadId?: string; title?: string }): Promise<AgentControllerThreadInfo> {
    return this.request(this.url(`${this.base()}/threads/clone`), {
      method: 'POST',
      body: options ?? {},
    });
  }

  /** List messages for a specific thread. */
  async listMessages(threadId: string, limit?: number): Promise<MastraDBMessage[]> {
    const params = limit != null ? `?limit=${limit}` : '';
    const body = await this.request<{ messages: SerializedMastraDBMessage[] }>(
      this.url(`${this.base()}/threads/${encodeURIComponent(threadId)}/messages${params}`),
    );
    return body.messages.map(hydrateMessage);
  }

  /**
   * Queue a follow-up message. If the session is idle it sends immediately;
   * if a run is active it queues for after completion.
   */
  async followUp(message: string, options?: AgentControllerMessageOptions): Promise<void> {
    const requestContext = parseClientRequestContext(options?.requestContext);
    await this.request(this.url(`${this.base()}/follow-up`), {
      method: 'POST',
      body: {
        message,
        ...(options?.attributes ? { attributes: options.attributes } : {}),
        ...(requestContext ? { requestContext } : {}),
      },
    });
  }

  /** Get the observational memory record for this session's thread. */
  async getOMRecord(): Promise<unknown> {
    const body = await this.request<{ record: unknown }>(this.url(`${this.base()}/om`));
    return body.record;
  }

  /** Change the session's resource identity. */
  async setResourceId(newResourceId: string): Promise<void> {
    await this.request(this.url(`${this.base()}/resource`), {
      method: 'POST',
      body: { newResourceId },
    });
  }

  /** Get known resource IDs for this session. */
  async getResourceIds(): Promise<string[]> {
    const body = await this.request<{ resourceIds: string[] }>(this.url(`${this.base()}/resources`));
    return body.resourceIds;
  }

  /** Get the current goal for this session's thread. */
  async getGoal(): Promise<AgentControllerGoalRecord | undefined> {
    const body = await this.request<{ goal?: AgentControllerGoalRecord }>(this.url(`${this.base()}/goal`));
    return body.goal;
  }

  /** Set a new goal objective. The agent's in-loop judge evaluates progress after each turn. */
  async setGoal(
    objective: string,
    options?: { judgeModelId?: string; maxRuns?: number },
  ): Promise<AgentControllerGoalRecord | undefined> {
    const body = await this.request<{ goal?: AgentControllerGoalRecord }>(this.url(`${this.base()}/goal`), {
      method: 'POST',
      body: { objective, ...options },
    });
    return body.goal;
  }

  /** Update goal options (judge model, max runs, status). */
  async updateGoal(options: {
    judgeModelId?: string;
    maxRuns?: number;
    status?: 'active' | 'paused' | 'done';
  }): Promise<AgentControllerGoalRecord | undefined> {
    const body = await this.request<{ goal?: AgentControllerGoalRecord }>(this.url(`${this.base()}/goal`), {
      method: 'PUT',
      body: options,
    });
    return body.goal;
  }

  /** Clear the current goal. */
  async clearGoal(): Promise<void> {
    await this.request(this.url(`${this.base()}/goal`), { method: 'DELETE' });
  }

  // ---------------------------------------------------------------------------
  // Permissions
  // ---------------------------------------------------------------------------

  /** Get the current permission rules (per-category and per-tool policies). */
  async getPermissions(): Promise<PermissionRules> {
    return this.request(this.url(`${this.base()}/permissions`));
  }

  /** Set the approval policy for a tool category. */
  async setPermissionForCategory(category: ToolCategory, policy: PermissionPolicy): Promise<void> {
    await this.request(this.url(`${this.base()}/permissions/category`), {
      method: 'PUT',
      body: { category, policy },
    });
  }

  /** Set the approval policy for a specific tool. */
  async setPermissionForTool(toolName: string, policy: PermissionPolicy): Promise<void> {
    await this.request(this.url(`${this.base()}/permissions/tool`), {
      method: 'PUT',
      body: { toolName, policy },
    });
  }

  /**
   * Send a notification signal to this session. The agent's delivery policy
   * determines whether the notification wakes an idle thread, is summarised,
   * or is persisted for later.
   */
  async sendNotification(input: SendNotificationInput): Promise<SendNotificationResult> {
    return this.request(this.url(`${this.base()}/notifications`), {
      method: 'POST',
      body: input,
    });
  }
}

/** An agent controller hosted on the connected Mastra instance. */
export class AgentController extends BaseResource {
  constructor(
    options: ClientOptions,
    private readonly controllerId: string,
  ) {
    super(options);
  }

  private basePath() {
    return `/agent-controller/${encodeURIComponent(this.controllerId)}`;
  }

  /** List the modes configured on this agent controller (e.g. build, plan). */
  async listModes(): Promise<AgentControllerModeInfo[]> {
    const body = await this.request<{ modes: AgentControllerModeInfo[] }>(`${this.basePath()}/modes`);
    return body.modes;
  }

  /** List available models on this agent controller (with auth status and use counts). */
  async listModels(): Promise<AgentControllerAvailableModel[]> {
    const body = await this.request<{ models: AgentControllerAvailableModel[] }>(`${this.basePath()}/models`);
    return body.models;
  }

  /** Get workspace status for this agent controller. */
  async workspaceStatus(): Promise<AgentControllerWorkspaceStatus> {
    return this.request(`${this.basePath()}/workspace`);
  }

  /**
   * Scope to a session bound to `resourceId` (e.g. a user or conversation id).
   * Pass `scope` to address an independent session over the same resourceId
   * (e.g. one session per git worktree, with the worktree path as the scope).
   */
  session(resourceId: string, scope?: string): AgentControllerSession {
    return new AgentControllerSession(this.options, this.controllerId, resourceId, scope);
  }
}

/** Pull the plain text out of an assistant message's nested content parts. */
export function agentControllerMessageText(message: MastraDBMessage): string {
  return message.content.parts
    .filter((p): p is MastraMessagePart & { text: string } => p.type === 'text' && typeof p.text === 'string')
    .map(p => p.text)
    .join('');
}
