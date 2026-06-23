import type { ClientOptions } from '../types';

import { BaseResource } from './base';

/**
 * Harness session client.
 *
 * Mirrors the harness HTTP routes served when a Harness is registered on a
 * Mastra instance (`new Mastra({ harnesses })`):
 *
 *   GET  /harness                                          listHarnesses
 *   POST /harness/:id/sessions                             session().create()
 *   GET  /harness/:id/sessions/:resourceId/stream          session().subscribe()
 *   POST /harness/:id/sessions/:resourceId/messages        session().sendMessage()
 *   POST /harness/:id/sessions/:resourceId/abort           session().abort()
 *   POST /harness/:id/sessions/:resourceId/tool-approval   session().approveTool()
 */

export interface HarnessInfo {
  id: string;
}

export interface HarnessMessageContent {
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

export interface HarnessMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: HarnessMessageContent[];
  stopReason?: string;
  errorMessage?: string;
}

/**
 * Harness events the SDK types explicitly. This is a discriminated union, so
 * narrowing on `event.type` gives you the right payload fields. This mirrors the
 * subset of the harness event stream a web client typically renders.
 */
export type KnownHarnessEvent =
  | { type: 'agent_start' }
  | { type: 'agent_end'; reason?: 'complete' | 'aborted' | 'error' | 'suspended' }
  // Assistant message streaming.
  | { type: 'message_start'; message: HarnessMessage }
  | { type: 'message_update'; message: HarnessMessage }
  | { type: 'message_end'; message: HarnessMessage }
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
  | { type: 'task_updated'; tasks: HarnessTaskSnapshot[] }
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

/** Any other harness event the SDK doesn't model explicitly. */
export interface OtherHarnessEvent {
  type: string;
  [key: string]: unknown;
}

/**
 * A harness event. Narrow on `type` to access known payloads; unknown event
 * types fall through to {@link OtherHarnessEvent}.
 */
export type HarnessEvent = KnownHarnessEvent | OtherHarnessEvent;

export interface CreateHarnessSessionResponse {
  harnessId: string;
  resourceId: string;
  threadId?: string;
}

export interface HarnessSessionState {
  harnessId: string;
  resourceId: string;
  threadId?: string;
  modeId: string;
  modelId: string;
}

export interface HarnessModeInfo {
  id: string;
  name?: string;
}

export interface HarnessThreadInfo {
  id: string;
  title?: string;
  resourceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HarnessAvailableModel {
  id: string;
  provider: string;
  modelName: string;
  hasApiKey: boolean;
  apiKeyEnvVar?: string;
  useCount: number;
}

export interface HarnessWorkspaceStatus {
  hasWorkspace: boolean;
  isReady: boolean;
}

export interface HarnessGoalRecord {
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
export interface HarnessTaskSnapshot {
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

export interface SubscribeHarnessSessionOptions {
  /** Called for each harness event received over the stream. */
  onEvent: (event: HarnessEvent) => void;
  /** Called when the stream errors or ends unexpectedly. */
  onError?: (error: unknown) => void;
}

export interface HarnessSubscription {
  /** Stop reading and release the underlying stream. */
  unsubscribe: () => void;
}

/**
 * A session bound to a `resourceId` within one harness. Sessions are
 * get-or-create on the server, so re-creating the same resourceId resumes the
 * existing conversation rather than forking it.
 */
export class HarnessSession extends BaseResource {
  constructor(
    options: ClientOptions,
    private readonly harnessId: string,
    private readonly resourceId: string,
  ) {
    super(options);
  }

  private base() {
    return `/harness/${encodeURIComponent(this.harnessId)}/sessions/${encodeURIComponent(this.resourceId)}`;
  }

  /** Create or resume this session. */
  create(): Promise<CreateHarnessSessionResponse> {
    return this.request(`/harness/${encodeURIComponent(this.harnessId)}/sessions`, {
      method: 'POST',
      body: { resourceId: this.resourceId },
    });
  }

  /**
   * Subscribe to this session's event stream (SSE). The assistant's reply to a
   * message arrives here as `message_*` events, not on the sendMessage call.
   */
  async subscribe(options: SubscribeHarnessSessionOptions): Promise<HarnessSubscription> {
    const response = (await this.request(`${this.base()}/stream`, { stream: true })) as Response;
    if (!response.body) {
      throw new Error('No response body for harness session stream');
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
                options.onEvent(JSON.parse(data) as HarnessEvent);
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
  state(): Promise<HarnessSessionState> {
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
  async listThreads(limit?: number): Promise<HarnessThreadInfo[]> {
    const query = limit != null ? `?limit=${limit}` : '';
    const body = await this.request<{ threads: HarnessThreadInfo[] }>(`${this.base()}/threads${query}`);
    return body.threads;
  }

  /** Switch the session to an existing thread (rebinds stream + state). */
  async switchThread(threadId: string): Promise<void> {
    await this.request(`${this.base()}/thread`, { method: 'POST', body: { threadId } });
  }

  /** Create a new thread (unbinds previous, binds the new one). */
  async createThread(title?: string): Promise<HarnessThreadInfo> {
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
  async cloneThread(options?: { sourceThreadId?: string; title?: string }): Promise<HarnessThreadInfo> {
    return this.request(`${this.base()}/threads/clone`, {
      method: 'POST',
      body: options ?? {},
    });
  }

  /** List messages for a specific thread. */
  async listMessages(threadId: string, limit?: number): Promise<HarnessMessage[]> {
    const params = limit != null ? `?limit=${limit}` : '';
    const body = await this.request<{ messages: HarnessMessage[] }>(
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
  async getGoal(): Promise<HarnessGoalRecord | undefined> {
    const body = await this.request<{ goal?: HarnessGoalRecord }>(`${this.base()}/goal`);
    return body.goal;
  }

  /** Set a new goal objective. The agent's in-loop judge evaluates progress after each turn. */
  async setGoal(
    objective: string,
    options?: { judgeModelId?: string; maxRuns?: number },
  ): Promise<HarnessGoalRecord | undefined> {
    const body = await this.request<{ goal?: HarnessGoalRecord }>(`${this.base()}/goal`, {
      method: 'POST',
      body: { objective, ...options },
    });
    return body.goal;
  }

  /** Update goal options (judge model, max runs, status). */
  async updateGoal(
    options: { judgeModelId?: string; maxRuns?: number; status?: 'active' | 'paused' | 'done' },
  ): Promise<HarnessGoalRecord | undefined> {
    const body = await this.request<{ goal?: HarnessGoalRecord }>(`${this.base()}/goal`, {
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

/** A harness hosted on the connected Mastra instance. */
export class Harness extends BaseResource {
  constructor(
    options: ClientOptions,
    private readonly harnessId: string,
  ) {
    super(options);
  }

  private basePath() {
    return `/harness/${encodeURIComponent(this.harnessId)}`;
  }

  /** List the modes configured on this harness (e.g. build, plan). */
  async listModes(): Promise<HarnessModeInfo[]> {
    const body = await this.request<{ modes: HarnessModeInfo[] }>(`${this.basePath()}/modes`);
    return body.modes;
  }

  /** List available models on this harness (with auth status and use counts). */
  async listModels(): Promise<HarnessAvailableModel[]> {
    const body = await this.request<{ models: HarnessAvailableModel[] }>(`${this.basePath()}/models`);
    return body.models;
  }

  /** Get workspace status for this harness. */
  async workspaceStatus(): Promise<HarnessWorkspaceStatus> {
    return this.request(`${this.basePath()}/workspace`);
  }

  /** Scope to a session bound to `resourceId` (e.g. a user or conversation id). */
  session(resourceId: string): HarnessSession {
    return new HarnessSession(this.options, this.harnessId, resourceId);
  }
}

/** Pull the plain text out of an assistant message's content parts. */
export function harnessMessageText(message: HarnessMessage): string {
  return message.content
    .filter(c => c.type === 'text' && typeof c.text === 'string')
    .map(c => c.text)
    .join('');
}
