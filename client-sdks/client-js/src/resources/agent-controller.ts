import type { ClientOptions } from '../types';

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

export interface AgentControllerMessageContent {
  type: 'text' | 'thinking' | 'tool_call' | 'tool_result' | string;
  /** Correlates a `tool_call` part with its `tool_result` part. */
  id?: string;
  text?: string;
  thinking?: string;
  name?: string;
  args?: unknown;
  result?: unknown;
  isError?: boolean;
}

export interface AgentControllerMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: AgentControllerMessageContent[];
  stopReason?: string;
  errorMessage?: string;
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
  | { type: 'message_start'; message: AgentControllerMessage }
  | { type: 'message_update'; message: AgentControllerMessage }
  | { type: 'message_end'; message: AgentControllerMessage }
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

/** Options for subscribing to an agent controller session's event stream. */
export interface SubscribeAgentControllerSessionOptions {
  /** Called for each event received over the stream. */
  onEvent: (event: AgentControllerEvent) => void;
  /** Called when the stream errors or ends unexpectedly. */
  onError?: (error: unknown) => void;
}

export interface AgentControllerSubscription {
  /** Stop reading and release the underlying stream. */
  unsubscribe: () => void;
}

/**
 * A session bound to a `resourceId` within one agent controller. Sessions are
 * get-or-create on the server, so re-creating the same resourceId resumes the
 * existing conversation rather than forking it.
 */
export class AgentControllerSession extends BaseResource {
  constructor(
    options: ClientOptions,
    private readonly controllerId: string,
    private readonly resourceId: string,
  ) {
    super(options);
  }

  private base() {
    return `/agent-controller/${encodeURIComponent(this.controllerId)}/sessions/${encodeURIComponent(this.resourceId)}`;
  }

  /**
   * Create or resume this session. Pass `tags` to scope initial thread
   * selection — a thread is a resume candidate only when its metadata matches
   * every tag. Required when sessions share a resourceId (e.g. git worktrees
   * using a `{ projectPath }` tag) so each resumes its own thread instead of the
   * most recent thread across the whole resource.
   */
  create(options?: {
    tags?: Record<string, string>;
    requestContext?: Record<string, unknown>;
  }): Promise<CreateAgentControllerSessionResponse> {
    return this.request(`/agent-controller/${encodeURIComponent(this.controllerId)}/sessions`, {
      method: 'POST',
      body: { resourceId: this.resourceId, tags: options?.tags, requestContext: options?.requestContext },
    });
  }

  /**
   * Subscribe to this session's event stream (SSE). The assistant's reply to a
   * message arrives here as `message_*` events, not on the sendMessage call.
   */
  async subscribe(options: SubscribeAgentControllerSessionOptions): Promise<AgentControllerSubscription> {
    const response = (await this.request(`${this.base()}/stream`, { stream: true })) as Response;
    if (!response.body) {
      throw new Error('No response body for agent controller session stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let cancelled = false;
    let buffer = '';

    const pump = async () => {
      try {
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE frames are separated by a blank line.
          let sep: number;
          while ((sep = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            for (const line of frame.split('\n')) {
              if (!line.startsWith('data:')) continue; // skip ": heartbeat" comments
              const data = line.slice(5).trim();
              if (!data) continue;
              try {
                options.onEvent(JSON.parse(data) as AgentControllerEvent);
              } catch {
                // ignore malformed frame
              }
            }
          }
        }
      } catch (error) {
        if (!cancelled) options.onError?.(error);
      }
    };

    void pump();

    return {
      unsubscribe: () => {
        cancelled = true;
        void reader.cancel().catch(() => {});
      },
    };
  }

  /** Send a user message. The reply streams over `subscribe()`. */
  async sendMessage(message: string): Promise<void> {
    await this.request(`${this.base()}/messages`, { method: 'POST', body: { message } });
  }

  /** Abort the in-flight run for this session. */
  async abort(): Promise<void> {
    await this.request(`${this.base()}/abort`, { method: 'POST' });
  }

  /** Approve or decline a pending tool call (`tool_approval_required`). */
  async approveTool(toolCallId: string, approved: boolean): Promise<void> {
    await this.request(`${this.base()}/tool-approval`, {
      method: 'POST',
      body: { toolCallId, approved },
    });
  }

  /**
   * Resume a suspended interactive tool (`tool_suspended`). The resume shape
   * depends on the tool: a string (or string[]) for `ask_user`, "Yes"/"No" for
   * `request_access`, and a {@link PlanResume} for `submit_plan`.
   */
  async respondToToolSuspension(toolCallId: string, resumeData: string | string[] | PlanResume): Promise<void> {
    await this.request(`${this.base()}/tool-suspension`, {
      method: 'POST',
      body: { toolCallId, resumeData },
    });
  }

  /** Inject a message into the in-flight run without starting a new turn. */
  async steer(message: string): Promise<void> {
    await this.request(`${this.base()}/steer`, { method: 'POST', body: { message } });
  }

  /** Get the current mode, model, and thread (for initial UI hydration). */
  state(): Promise<AgentControllerSessionState> {
    return this.request(this.base());
  }

  /** Merge key-value pairs into the session state. Existing keys not in the payload are preserved. */
  async setState(updates: Record<string, unknown>): Promise<void> {
    await this.request(`${this.base()}/state`, { method: 'PUT', body: { state: updates } });
  }

  /** Switch the active mode (e.g. `build`, `plan`). */
  async switchMode(modeId: string): Promise<void> {
    await this.request(`${this.base()}/mode`, { method: 'POST', body: { modeId } });
  }

  /** Switch the model. Defaults to thread scope. */
  async switchModel(modelId: string, options?: { scope?: 'global' | 'thread'; modeId?: string }): Promise<void> {
    await this.request(`${this.base()}/model`, {
      method: 'POST',
      body: { modelId, scope: options?.scope, modeId: options?.modeId },
    });
  }

  /** List the threads for this session's resource, most-recently-updated first. Pass `limit` for just the newest N. */
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
    const body = await this.request<{ threads: AgentControllerThreadInfo[] }>(`${this.base()}/threads${query}`);
    return body.threads;
  }

  /** Switch the session to an existing thread (rebinds stream + state). */
  async switchThread(threadId: string): Promise<void> {
    await this.request(`${this.base()}/thread`, { method: 'POST', body: { threadId } });
  }

  /** Create a new thread (unbinds previous, binds the new one). */
  async createThread(title?: string): Promise<AgentControllerThreadInfo> {
    return this.request(`${this.base()}/threads`, {
      method: 'POST',
      body: { title },
    });
  }

  /** Delete a thread. If it's the active thread the session unbinds. */
  async deleteThread(threadId: string): Promise<void> {
    await this.request(`${this.base()}/threads/${encodeURIComponent(threadId)}`, {
      method: 'DELETE',
    });
  }

  /** Rename a thread. */
  async renameThread(threadId: string, title: string): Promise<void> {
    await this.request(`${this.base()}/threads/${encodeURIComponent(threadId)}`, {
      method: 'PUT',
      body: { title },
    });
  }

  /** Clone a thread (and its messages). The session binds to the clone. */
  async cloneThread(options?: { sourceThreadId?: string; title?: string }): Promise<AgentControllerThreadInfo> {
    return this.request(`${this.base()}/threads/clone`, {
      method: 'POST',
      body: options ?? {},
    });
  }

  /** List messages for a specific thread. */
  async listMessages(threadId: string, limit?: number): Promise<AgentControllerMessage[]> {
    const params = limit != null ? `?limit=${limit}` : '';
    const body = await this.request<{ messages: AgentControllerMessage[] }>(
      `${this.base()}/threads/${encodeURIComponent(threadId)}/messages${params}`,
    );
    return body.messages;
  }

  /**
   * Queue a follow-up message. If the session is idle it sends immediately;
   * if a run is active it queues for after completion.
   */
  async followUp(message: string): Promise<void> {
    await this.request(`${this.base()}/follow-up`, { method: 'POST', body: { message } });
  }

  /** Get the observational memory record for this session's thread. */
  async getOMRecord(): Promise<unknown> {
    const body = await this.request<{ record: unknown }>(`${this.base()}/om`);
    return body.record;
  }

  /** Change the session's resource identity. */
  async setResourceId(newResourceId: string): Promise<void> {
    await this.request(`${this.base()}/resource`, {
      method: 'POST',
      body: { newResourceId },
    });
  }

  /** Get known resource IDs for this session. */
  async getResourceIds(): Promise<string[]> {
    const body = await this.request<{ resourceIds: string[] }>(`${this.base()}/resources`);
    return body.resourceIds;
  }

  /** Get the current goal for this session's thread. */
  async getGoal(): Promise<AgentControllerGoalRecord | undefined> {
    const body = await this.request<{ goal?: AgentControllerGoalRecord }>(`${this.base()}/goal`);
    return body.goal;
  }

  /** Set a new goal objective. The agent's in-loop judge evaluates progress after each turn. */
  async setGoal(
    objective: string,
    options?: { judgeModelId?: string; maxRuns?: number },
  ): Promise<AgentControllerGoalRecord | undefined> {
    const body = await this.request<{ goal?: AgentControllerGoalRecord }>(`${this.base()}/goal`, {
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
    const body = await this.request<{ goal?: AgentControllerGoalRecord }>(`${this.base()}/goal`, {
      method: 'PUT',
      body: options,
    });
    return body.goal;
  }

  /** Clear the current goal. */
  async clearGoal(): Promise<void> {
    await this.request(`${this.base()}/goal`, { method: 'DELETE' });
  }

  // ---------------------------------------------------------------------------
  // Permissions
  // ---------------------------------------------------------------------------

  /** Get the current permission rules (per-category and per-tool policies). */
  async getPermissions(): Promise<PermissionRules> {
    return this.request(`${this.base()}/permissions`);
  }

  /** Set the approval policy for a tool category. */
  async setPermissionForCategory(category: ToolCategory, policy: PermissionPolicy): Promise<void> {
    await this.request(`${this.base()}/permissions/category`, {
      method: 'PUT',
      body: { category, policy },
    });
  }

  /** Set the approval policy for a specific tool. */
  async setPermissionForTool(toolName: string, policy: PermissionPolicy): Promise<void> {
    await this.request(`${this.base()}/permissions/tool`, {
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
    return this.request(`${this.base()}/notifications`, {
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

  /** Scope to a session bound to `resourceId` (e.g. a user or conversation id). */
  session(resourceId: string): AgentControllerSession {
    return new AgentControllerSession(this.options, this.controllerId, resourceId);
  }
}

/** Pull the plain text out of an assistant message's content parts. */
export function agentControllerMessageText(message: AgentControllerMessage): string {
  return message.content
    .filter(c => c.type === 'text' && typeof c.text === 'string')
    .map(c => c.text)
    .join('');
}
