import { v4 as uuid } from '@lukeed/uuid';
import type { HarnessEvent } from '@mastra/core/harness/v1';

import type {
  GetHarnessNameSessions_Response,
  GetHarnessNameSessions_QueryParams,
  GetHarnessNameSessionsSessionId_Response,
  PostHarnessNameSessions_Body,
  PostHarnessNameSessions_Response,
} from '../route-types.generated.js';
import type { ClientOptions, RequestOptions } from '../types';
import { MastraClientError } from '../types.js';
import { BaseResource } from './base';

type JsonObject = Record<string, unknown>;
export type HarnessSessionSnapshot = GetHarnessNameSessionsSessionId_Response;
export type HarnessSessionSummary = GetHarnessNameSessions_Response['items'][number];
export type CreateHarnessSessionBody = PostHarnessNameSessions_Body;
export type CreateHarnessSessionResponse = PostHarnessNameSessions_Response;
export type AttachmentRef = {
  attachmentId: string;
  resourceId: string;
  ownerSessionId?: string;
  bytes?: number;
  sha256?: string;
  source?: 'inline' | 'preupload' | 'url' | 'provider';
  kind?: 'file' | 'primitive' | 'element';
  name?: string;
  mimeType?: string;
  primitiveType?: string;
  elementType?: string;
  renderer?: JsonObject;
  schemaId?: string;
  metadata?: JsonObject;
  object?: JsonObject;
};
export type MessageAdmissionBody = {
  content: string;
  admissionId: string;
  mode?: string;
  model?: string;
  attachments?: AttachmentRef[];
};
export type MessageAdmissionResponse = { accepted: true; signalId: string; runId?: string; duplicate: boolean };
export type QueueAdmissionBody = MessageAdmissionBody & { yolo?: boolean };
export type QueueAdmissionResponse = { accepted: true; queuedItemId: string; duplicate: boolean };
export type MessageOperationResult =
  | { status: 'pending'; source: 'message'; runId?: string }
  | { status: 'completed'; source: 'message'; runId?: string; result: unknown }
  | { status: 'failed'; source: 'message'; runId?: string; error: { code: string; message: string } }
  | { status: 'expired'; source: 'message'; runId?: string; expiredAt?: number }
  | { status: 'not_found'; source: 'message' };
export type QueueOperationResult =
  | { status: 'pending'; source: 'queue'; runId?: string }
  | { status: 'completed'; source: 'queue'; runId?: string; result: unknown }
  | { status: 'failed'; source: 'queue'; runId?: string; error: { code: string; message: string } }
  | { status: 'expired'; source: 'queue'; runId?: string; expiredAt?: number }
  | { status: 'not_found'; source: 'queue' };
type OperationResult = MessageOperationResult | QueueOperationResult;
export type InboxResponseBody =
  | { kind: 'tool-approval'; approved: boolean; reason?: string; responseId: string }
  | { kind: 'tool-suspension'; resumeData: unknown; responseId: string }
  | { kind: 'question'; answer: unknown; responseId: string }
  | { kind: 'plan-approval'; approved: boolean; revision?: string; responseId: string; transitionToMode?: string };
export type InboxResponseResult = {
  itemId: string;
  kind: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';
  status: 'accepted' | 'applied';
  responseId: string;
  duplicate: boolean;
};
export type GoalBody = { objective: string; judgeModel?: string; maxTurns?: number; kickoff?: boolean };
export type Goal = {
  id: string;
  objective: string;
  status: 'active' | 'paused' | 'done';
  turnsUsed: number;
  maxTurns: number;
  judgeModelId: string;
  createdAt: number;
  lastDecision?: { decision: 'done' | 'continue' | 'waiting'; reason: string; judgedAt: number };
};
export type GoalResponse = { goal: Goal | null };
export type PermissionsBody =
  | { action: 'grantCategory'; category: string }
  | { action: 'grantTool'; toolName: string }
  | { action: 'revokeCategory'; category: string }
  | { action: 'revokeTool'; toolName: string }
  | { action: 'setPolicy'; category?: string; toolName?: string; policy: 'allow' | 'ask' | 'deny' };
export type PermissionsResponse = {
  grants: unknown;
  rules: unknown;
};
type HarnessRequestOptions = RequestOptions & { signal?: AbortSignal; retries?: number };

export interface RemoteHarnessListSessionsOptions extends GetHarnessNameSessions_QueryParams {}
export interface RemoteHarnessSessionOptions extends CreateHarnessSessionBody {}

export interface RemoteSessionOperationOptions {
  /**
   * Stable client admission id. Pass this when the caller needs durable recovery
   * from ambiguous admission failures; otherwise the convenience helpers mint one
   * for the current call only.
   */
  admissionId?: string;
  mode?: string;
  model?: string;
  attachments?: MessageAdmissionBody['attachments'];
}

export interface RemoteSessionMessageOptions extends RemoteSessionOperationOptions {
  content: string;
  stream?: never;
  sync?: never;
  output?: never;
}

export interface RemoteSessionQueueOptions extends RemoteSessionOperationOptions {
  content: string;
  yolo?: boolean;
}

export interface RemoteHarnessSubscriptionOptions {
  lastEventId?: string;
  signal?: AbortSignal;
  reconnect?: boolean;
  onReplayGap?: () => void | Promise<void>;
  onError?: (error: unknown) => void | Promise<void>;
}

export interface RemoteHarnessStatePatchOptions {
  ifVersion?: number;
}

export type RemoteHarnessEventListener = (event: HarnessEvent) => void | Promise<void>;
export type RemoteHarnessEventUnsubscribe = () => void;
export type RemoteHarnessAgentResult = unknown;

export class RemoteHarnessUnsupportedError extends Error {
  readonly name = 'RemoteHarnessUnsupportedError';
}

export class RemoteHarnessOperationError extends Error {
  readonly name = 'RemoteHarnessOperationError';
  readonly code: string;
  readonly status: OperationResult['status'];

  constructor(result: Extract<OperationResult, { status: 'failed' | 'expired' | 'not_found' }>) {
    const code = result.status === 'failed' ? result.error.code : `harness.operation_${result.status}`;
    const message =
      result.status === 'failed'
        ? result.error.message
        : result.status === 'expired'
          ? 'Harness operation result evidence expired'
          : 'Harness operation result was not found';
    super(message);
    this.code = code;
    this.status = result.status;
  }
}

export class RemoteHarnessStateVersionError extends Error {
  readonly name = 'RemoteHarnessStateVersionError';

  constructor() {
    super('RemoteSession.setState() requires a session ETag; refresh the session snapshot and retry');
  }
}

export class RemoteHarness extends BaseResource {
  constructor(
    options: ClientOptions,
    private readonly name = 'default',
  ) {
    super(options);
  }

  listSessions(options: RemoteHarnessListSessionsOptions = {}): Promise<GetHarnessNameSessions_Response> {
    const searchParams = new URLSearchParams();
    if (options.cursor) searchParams.set('cursor', options.cursor);
    if (options.limit !== undefined) searchParams.set('limit', String(options.limit));
    if (options.includeClosed !== undefined) searchParams.set('includeClosed', String(options.includeClosed));
    const query = searchParams.toString();
    return this.request(`/harness/${encodeURIComponent(this.name)}/sessions${query ? `?${query}` : ''}`);
  }

  async session(options: RemoteHarnessSessionOptions = {}): Promise<RemoteSession> {
    if (options.sessionId !== undefined && Object.keys(options).every(key => key === 'sessionId')) {
      return this.getSession(options.sessionId);
    }

    const response = (await requestJson<CreateHarnessSessionResponse>(
      this.options,
      this.apiPrefix,
      `/harness/${encodeURIComponent(this.name)}/sessions`,
      {
        method: 'POST',
        body: options,
        retries: 0,
      },
    )) as CreateHarnessSessionResponse;
    return new RemoteSession(this.options, this.name, response.session);
  }

  async getSession(sessionId: string): Promise<RemoteSession> {
    return new RemoteSession(this.options, this.name, await this.getSnapshot(sessionId));
  }

  getSnapshot(sessionId: string): Promise<HarnessSessionSnapshot> {
    return this.request(`/harness/${encodeURIComponent(this.name)}/sessions/${encodeURIComponent(sessionId)}`);
  }
}

export class RemoteSession extends BaseResource {
  readonly id: string;
  readonly resourceId: string;
  readonly threadId: string;
  readonly parentSessionId?: string;
  readonly createdAt: number;

  private snapshot: HarnessSessionSnapshot;
  private lastEventId: string | undefined;
  private stateVersion: number | undefined;

  constructor(
    options: ClientOptions,
    private readonly harnessName: string,
    snapshot: HarnessSessionSnapshot,
  ) {
    super(options);
    this.snapshot = snapshot;
    this.id = snapshot.summary.sessionId;
    this.resourceId = snapshot.summary.resourceId;
    this.threadId = snapshot.summary.threadId;
    this.parentSessionId = snapshot.summary.parentSessionId;
    this.createdAt = snapshot.summary.createdAt;
  }

  get lastActivityAt(): number {
    return this.snapshot.summary.lastActivityAt;
  }

  get summary(): HarnessSessionSummary {
    return this.snapshot.summary;
  }

  getDisplayState(): unknown {
    return this.snapshot.displayState;
  }

  getTokenUsage(): HarnessSessionSnapshot['tokenUsage'] {
    return this.snapshot.tokenUsage;
  }

  getQueueDepth(): number {
    return this.snapshot.queue.depth;
  }

  isBusy(): boolean {
    return this.snapshot.summary.busy;
  }

  async refresh(): Promise<HarnessSessionSnapshot> {
    this.snapshot = await this.getSnapshot();
    return this.snapshot;
  }

  async getSnapshot(): Promise<HarnessSessionSnapshot> {
    const { data, response } = await this.requestJsonWithResponse<HarnessSessionSnapshot>(this.sessionPath());
    this.stateVersion = parseSessionVersionFromEtag(response.headers.get('etag')) ?? this.stateVersion;
    return data;
  }

  getState<TState = Record<string, unknown>>(): TState {
    return this.snapshot.state as TState;
  }

  async setState<TState extends Record<string, unknown>>(
    updates: Partial<TState>,
    options: RemoteHarnessStatePatchOptions = {},
  ): Promise<TState> {
    const expectedVersion = options.ifVersion ?? this.stateVersion;
    if (expectedVersion === undefined) {
      await this.refresh();
    }
    const version = options.ifVersion ?? this.stateVersion;
    if (version === undefined) {
      throw new RemoteHarnessStateVersionError();
    }
    const { data: state, response } = await this.requestJsonWithResponse<TState>(`${this.sessionPath()}/state`, {
      method: 'PATCH',
      body: updates,
      headers: { 'if-match': `"${version}"` },
      retries: 0,
    });
    this.stateVersion = parseSessionVersionFromEtag(response.headers.get('etag')) ?? version + 1;
    this.snapshot = { ...this.snapshot, state: state as HarnessSessionSnapshot['state'] };
    return state;
  }

  async switchMode(options: { mode: string }): Promise<{ modeId: string }> {
    const response = await this.request<{ modeId: string }>(`${this.sessionPath()}/mode`, {
      method: 'PATCH',
      body: options,
    });
    this.snapshot = { ...this.snapshot, summary: { ...this.snapshot.summary, modeId: response.modeId } };
    return response;
  }

  async switchModel(options: { model: string }): Promise<{ modelId: string }> {
    const response = await this.request<{ modelId: string }>(`${this.sessionPath()}/model`, {
      method: 'PATCH',
      body: options,
    });
    this.snapshot = { ...this.snapshot, summary: { ...this.snapshot.summary, modelId: response.modelId } };
    return response;
  }

  async patchPermissions(body: PermissionsBody): Promise<PermissionsResponse> {
    return this.request(`${this.sessionPath()}/permissions`, { method: 'PATCH', body });
  }

  readonly permissions = Object.freeze({
    grantCategory: (options: { category: string }) =>
      this.patchPermissions({ action: 'grantCategory', category: options.category }),
    grantTool: (options: { toolName: string }) =>
      this.patchPermissions({ action: 'grantTool', toolName: options.toolName }),
    revokeCategory: (options: { category: string }) =>
      this.patchPermissions({ action: 'revokeCategory', category: options.category }),
    revokeTool: (options: { toolName: string }) =>
      this.patchPermissions({ action: 'revokeTool', toolName: options.toolName }),
    setPolicy: (
      options:
        | { category: string; toolName?: never; policy: 'allow' | 'ask' | 'deny' }
        | { toolName: string; category?: never; policy: 'allow' | 'ask' | 'deny' },
    ) => this.patchPermissions({ action: 'setPolicy', ...options }),
  });

  async respondToInboxItem(itemId: string, body: InboxResponseBody): Promise<InboxResponseResult> {
    return this.request(`${this.sessionPath()}/inbox/${encodeURIComponent(itemId)}`, { method: 'POST', body });
  }

  respondToToolApproval(options: { itemId: string; responseId: string; approved: boolean; reason?: string }) {
    const { itemId, ...body } = options;
    return this.respondToInboxItem(itemId, { kind: 'tool-approval', ...body });
  }

  respondToToolSuspension(options: { itemId: string; responseId: string; resumeData: unknown }) {
    const { itemId, ...body } = options;
    return this.respondToInboxItem(itemId, { kind: 'tool-suspension', ...body });
  }

  respondToQuestion(options: { itemId: string; responseId: string; answer: unknown }) {
    const { itemId, ...body } = options;
    return this.respondToInboxItem(itemId, { kind: 'question', ...body });
  }

  respondToPlanApproval(options: {
    itemId: string;
    responseId: string;
    approved: boolean;
    revision?: string;
    transitionToMode?: string;
  }) {
    const { itemId, ...body } = options;
    return this.respondToInboxItem(itemId, { kind: 'plan-approval', ...body });
  }

  async setGoal(options: GoalBody): Promise<GoalResponse> {
    return (
      await this.requestJsonWithResponse<GoalResponse>(`${this.sessionPath()}/goal`, {
        method: 'PUT',
        body: options,
        retries: 0,
      })
    ).data;
  }

  getGoal(): Promise<GoalResponse> {
    return this.request(`${this.sessionPath()}/goal`);
  }

  pauseGoal(): Promise<GoalResponse> {
    return this.request(`${this.sessionPath()}/goal/pause`, { method: 'POST' });
  }

  async resumeGoal(): Promise<GoalResponse> {
    return (
      await this.requestJsonWithResponse<GoalResponse>(`${this.sessionPath()}/goal/resume`, {
        method: 'POST',
        retries: 0,
      })
    ).data;
  }

  async clearGoal(): Promise<void> {
    await this.request(`${this.sessionPath()}/goal`, { method: 'DELETE', stream: true });
  }

  async close(): Promise<void> {
    await this.request<unknown>(this.sessionPath(), { method: 'DELETE', stream: true });
  }

  /**
   * Admit a message and resolve with its durable result evidence. For ambiguous
   * admission failures, pass a stable `admissionId` or use `admitMessage()` plus
   * `settleMessage()` directly.
   */
  async message(options: RemoteSessionMessageOptions): Promise<RemoteHarnessAgentResult> {
    const admission = await this.admitMessage(options);
    return this.settleMessage(admission.signalId, { runId: admission.runId });
  }

  admitMessage(options: RemoteSessionMessageOptions): Promise<MessageAdmissionResponse> {
    const body: MessageAdmissionBody = {
      content: options.content,
      admissionId: options.admissionId ?? uuid(),
      ...(options.mode !== undefined ? { mode: options.mode } : {}),
      ...(options.model !== undefined ? { model: options.model } : {}),
      ...(options.attachments !== undefined ? { attachments: options.attachments } : {}),
    };
    return this.requestJson(`${this.sessionPath()}/messages`, { method: 'POST', body, retries: 0 });
  }

  /**
   * Admit queued work and resolve with its durable result evidence. For ambiguous
   * admission failures, pass a stable `admissionId` or use `admitQueue()` plus
   * `settleQueue()` directly.
   */
  async queue(options: RemoteSessionQueueOptions): Promise<RemoteHarnessAgentResult> {
    const admission = await this.admitQueue(options);
    return this.settleQueue(admission.queuedItemId);
  }

  admitQueue(options: RemoteSessionQueueOptions): Promise<QueueAdmissionResponse> {
    const body: QueueAdmissionBody = {
      content: options.content,
      admissionId: options.admissionId ?? uuid(),
      ...(options.mode !== undefined ? { mode: options.mode } : {}),
      ...(options.model !== undefined ? { model: options.model } : {}),
      ...(options.yolo !== undefined ? { yolo: options.yolo } : {}),
      ...(options.attachments !== undefined ? { attachments: options.attachments } : {}),
    };
    return this.requestJson(`${this.sessionPath()}/queue`, { method: 'POST', body, retries: 0 });
  }

  async settleMessage(signalId: string, options: { runId?: string } = {}): Promise<RemoteHarnessAgentResult> {
    return this.settleOperation('message', signalId, options);
  }

  async settleQueue(queuedItemId: string): Promise<RemoteHarnessAgentResult> {
    return this.settleOperation('queue', queuedItemId);
  }

  lookupMessageResult(signalId: string): Promise<MessageOperationResult> {
    return this.request(`${this.sessionPath()}/message-results/${encodeURIComponent(signalId)}`);
  }

  lookupQueueResult(queuedItemId: string): Promise<QueueOperationResult> {
    return this.request(`${this.sessionPath()}/queue/${encodeURIComponent(queuedItemId)}/result`);
  }

  subscribe(
    listener: RemoteHarnessEventListener,
    options: RemoteHarnessSubscriptionOptions = {},
  ): RemoteHarnessEventUnsubscribe {
    return this.subscribeToEvents(listener, options, true);
  }

  private subscribeToEvents(
    listener: RemoteHarnessEventListener,
    options: RemoteHarnessSubscriptionOptions,
    trackSessionCursor: boolean,
  ): RemoteHarnessEventUnsubscribe {
    if (trackSessionCursor && options.lastEventId !== undefined) {
      this.lastEventId = options.lastEventId;
    }
    const subscription = new RemoteHarnessEventSubscription(this.options, this.sessionPath(), listener, {
      ...options,
      lastEventId: options.lastEventId ?? this.lastEventId,
      onEventId: trackSessionCursor
        ? eventId => {
            this.lastEventId = eventId;
          }
        : undefined,
      onReplayGap: async () => {
        if (trackSessionCursor) {
          this.lastEventId = undefined;
          await this.refresh();
        }
        await options.onReplayGap?.();
      },
    });
    subscription.start();
    return () => subscription.close();
  }

  useSkill(): Promise<never> {
    return Promise.reject(
      new RemoteHarnessUnsupportedError(
        'RemoteSession.useSkill() requires Harness skill routes that are not mounted by the current server contract',
      ),
    );
  }

  listSkills(): Promise<never> {
    return Promise.reject(
      new RemoteHarnessUnsupportedError(
        'RemoteSession.listSkills() requires Harness skill descriptor routes that are not mounted by the current server contract',
      ),
    );
  }

  getSkill(): Promise<never> {
    return Promise.reject(
      new RemoteHarnessUnsupportedError(
        'RemoteSession.getSkill() requires Harness skill descriptor routes that are not mounted by the current server contract',
      ),
    );
  }

  private async settleOperation(
    source: 'message' | 'queue',
    operationId: string,
    options: { runId?: string } = {},
  ): Promise<RemoteHarnessAgentResult> {
    const initial = await this.lookupOperation(source, operationId);
    if (initial.status !== 'pending') return resultValueOrThrow(initial);

    return new Promise((resolve, reject) => {
      let unsubscribe: RemoteHarnessEventUnsubscribe = () => {};
      let pollTimer: ReturnType<typeof setInterval> | undefined;
      let settled = false;
      const cleanup = () => {
        unsubscribe();
        if (pollTimer !== undefined) {
          clearInterval(pollTimer);
          pollTimer = undefined;
        }
      };
      const finishFromLookup = async () => {
        if (settled) return;
        try {
          const result = await this.lookupOperation(source, operationId);
          if (result.status === 'pending') return;
          const value = resultValueOrThrow(result);
          settled = true;
          cleanup();
          resolve(value);
        } catch (error) {
          if (error instanceof RemoteHarnessOperationError) {
            settled = true;
            cleanup();
            reject(error);
            return;
          }
          if (isAbortError(error)) {
            settled = true;
            cleanup();
            reject(error);
            return;
          }
          const status = errorStatus(error);
          if (status === undefined || status >= 500) return;
          settled = true;
          cleanup();
          reject(error);
        }
      };
      unsubscribe = this.subscribeToEvents(
        async event => {
          if (!eventMatchesOperation(event, source, operationId, options.runId)) return;
          await finishFromLookup();
        },
        {
          onReplayGap: finishFromLookup,
          onError: () => void finishFromLookup(),
        },
        false,
      );
      pollTimer = setInterval(() => void finishFromLookup(), 1000);
    });
  }

  private lookupOperation(source: 'message' | 'queue', operationId: string): Promise<OperationResult> {
    return source === 'message' ? this.lookupMessageResult(operationId) : this.lookupQueueResult(operationId);
  }

  private async requestJsonWithResponse<T>(
    path: string,
    options: HarnessRequestOptions = {},
  ): Promise<{ data: T; response: Response }> {
    const response = await requestRaw(this.options, this.apiPrefix, path, options);
    return { data: (await response.json()) as T, response };
  }

  private requestJson<T>(path: string, options: HarnessRequestOptions = {}): Promise<T> {
    return requestJson(this.options, this.apiPrefix, path, options);
  }

  private sessionPath(): string {
    return `/harness/${encodeURIComponent(this.harnessName)}/sessions/${encodeURIComponent(this.id)}`;
  }
}

class RemoteHarnessEventSubscription extends BaseResource {
  private closed = false;
  private lastEventId: string | undefined;
  private abortController: AbortController | undefined;
  private reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  constructor(
    options: ClientOptions,
    private readonly path: string,
    private readonly listener: RemoteHarnessEventListener,
    private readonly subscriptionOptions: RemoteHarnessSubscriptionOptions & {
      onEventId?: (eventId: string) => void;
      onReplayGap?: () => Promise<void>;
    },
  ) {
    super(options);
    this.lastEventId = subscriptionOptions.lastEventId;
  }

  start(): void {
    void this.run().catch(error => {
      if (!this.closed && !this.subscriptionOptions.signal?.aborted) {
        void this.subscriptionOptions.onError?.(error);
      }
    });
  }

  close(): void {
    this.closed = true;
    this.abortController?.abort();
    void this.reader?.cancel();
  }

  private async run(): Promise<void> {
    let reconnectDelayMs = this.options.backoffMs ?? 100;
    const maxReconnectDelayMs = this.options.maxBackoffMs ?? 1000;
    while (!this.closed && !this.subscriptionOptions.signal?.aborted) {
      try {
        await this.readOnce();
        if (!this.subscriptionOptions.reconnect) return;
        await delayUnlessClosed(reconnectDelayMs, () => this.closed || !!this.subscriptionOptions.signal?.aborted);
        reconnectDelayMs = Math.min(reconnectDelayMs * 2, maxReconnectDelayMs);
      } catch (error) {
        if (this.closed || this.subscriptionOptions.signal?.aborted) return;
        if (isReplayGapError(error)) {
          await this.subscriptionOptions.onReplayGap?.();
          this.lastEventId = undefined;
          continue;
        }
        const status = errorStatus(error);
        if (status !== undefined && status >= 400 && status < 500) {
          await this.subscriptionOptions.onError?.(error);
          return;
        }
        if (!this.subscriptionOptions.reconnect) {
          await this.subscriptionOptions.onError?.(error);
          return;
        }
        await this.subscriptionOptions.onError?.(error);
        await delayUnlessClosed(reconnectDelayMs, () => this.closed || !!this.subscriptionOptions.signal?.aborted);
        reconnectDelayMs = Math.min(reconnectDelayMs * 2, maxReconnectDelayMs);
      }
    }
  }

  private async readOnce(): Promise<void> {
    const response = await this.requestEventStream();
    const body = response.body;
    if (!body) return;

    const reader = body.getReader();
    this.reader = reader;
    const decoder = new TextDecoder();
    let buffer = '';
    const abort = () => {
      this.abortController?.abort();
      void reader.cancel();
    };
    this.options.abortSignal?.addEventListener('abort', abort, { once: true });
    this.subscriptionOptions.signal?.addEventListener('abort', abort, { once: true });

    try {
      while (!this.closed) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split(/\r?\n\r?\n/);
        buffer = chunks.pop() ?? '';
        for (const chunk of chunks) {
          const event = parseHarnessSseChunk(chunk);
          if (!event) continue;
          if (this.closed) return;
          await this.listener(event);
          this.lastEventId = event.id;
          this.subscriptionOptions.onEventId?.(event.id);
        }
      }
    } finally {
      this.options.abortSignal?.removeEventListener('abort', abort);
      this.subscriptionOptions.signal?.removeEventListener('abort', abort);
      if (this.reader === reader) this.reader = undefined;
      this.abortController = undefined;
      reader.releaseLock();
    }
  }

  private async requestEventStream(): Promise<Response> {
    const controller = new AbortController();
    this.abortController = controller;
    const abort = () => controller.abort();
    this.options.abortSignal?.addEventListener('abort', abort, { once: true });
    this.subscriptionOptions.signal?.addEventListener('abort', abort, { once: true });

    try {
      return await requestRaw(this.options, this.apiPrefix, `${this.path}/events`, {
        stream: true,
        headers: this.lastEventId ? { 'Last-Event-ID': this.lastEventId } : undefined,
        signal: controller.signal,
        retries: 0,
      });
    } finally {
      this.options.abortSignal?.removeEventListener('abort', abort);
      this.subscriptionOptions.signal?.removeEventListener('abort', abort);
    }
  }
}

async function requestRaw(
  clientOptions: ClientOptions,
  apiPrefix: string,
  path: string,
  options: HarnessRequestOptions = {},
): Promise<Response> {
  const { retries: requestRetriesOverride, stream: _stream, signal: requestSignal, ...fetchOptions } = options;
  const {
    baseUrl,
    retries = 3,
    backoffMs = 100,
    maxBackoffMs = 1000,
    headers = {},
    credentials,
    fetch: customFetch,
  } = clientOptions;
  const requestRetries = requestRetriesOverride ?? retries;
  const fetchFn = customFetch || fetch;
  let delay = backoffMs;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= requestRetries; attempt++) {
    try {
      const response = await fetchFn(`${baseUrl.replace(/\/$/, '')}${apiPrefix}${path}`, {
        ...fetchOptions,
        headers: {
          ...(fetchOptions.body &&
          !(fetchOptions.body instanceof FormData) &&
          (fetchOptions.method === 'POST' ||
            fetchOptions.method === 'PUT' ||
            fetchOptions.method === 'PATCH' ||
            fetchOptions.method === 'DELETE')
            ? { 'content-type': 'application/json' }
            : {}),
          ...headers,
          ...fetchOptions.headers,
        },
        signal: requestSignal ?? clientOptions.abortSignal,
        credentials: fetchOptions.credentials ?? credentials,
        body:
          fetchOptions.body instanceof FormData
            ? fetchOptions.body
            : fetchOptions.body
              ? JSON.stringify(fetchOptions.body)
              : undefined,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let parsedBody: unknown;
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          parsedBody = JSON.parse(errorBody);
          errorMessage += ` - ${JSON.stringify(parsedBody)}`;
        } catch {
          if (errorBody) errorMessage += ` - ${errorBody}`;
        }
        throw new MastraClientError(response.status, response.statusText, errorMessage, parsedBody);
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      if (isAbortError(error)) {
        throw error;
      }
      const status = (error as Error & { status?: number }).status;
      if (status !== undefined && status >= 400 && status < 500) {
        throw error;
      }
      if (attempt === requestRetries) break;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, maxBackoffMs);
    }
  }

  throw lastError || new Error('Request failed');
}

async function requestJson<T>(
  clientOptions: ClientOptions,
  apiPrefix: string,
  path: string,
  options: HarnessRequestOptions = {},
): Promise<T> {
  const response = await requestRaw(clientOptions, apiPrefix, path, options);
  return (await response.json()) as T;
}

function parseSessionVersionFromEtag(etag: string | null): number | undefined {
  const match = etag ? /^"([0-9]+)"$/.exec(etag) : null;
  return match ? Number(match[1]) : undefined;
}

function parseHarnessSseChunk(chunk: string): HarnessEvent | undefined {
  const dataLines: string[] = [];
  for (const line of chunk.split(/\r?\n/)) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(line.startsWith('data: ') ? 6 : 5));
    }
  }
  if (dataLines.length === 0) return undefined;
  return JSON.parse(dataLines.join('\n')) as HarnessEvent;
}

function eventMatchesOperation(
  event: HarnessEvent,
  source: 'message' | 'queue',
  operationId: string,
  runId?: string,
): boolean {
  if (event.type !== 'agent_end') return false;
  if (source === 'message') {
    return event.signalId === operationId || (runId !== undefined && event.runId === runId);
  }
  return event.queuedItemId === operationId;
}

function resultValueOrThrow(result: OperationResult): RemoteHarnessAgentResult {
  switch (result.status) {
    case 'completed':
      return result.result;
    case 'failed':
    case 'expired':
    case 'not_found':
      throw new RemoteHarnessOperationError(result);
    case 'pending':
      throw new Error('Harness operation is still pending');
  }
}

function isReplayGapError(error: unknown): boolean {
  if (errorStatus(error) !== 412 || !(error instanceof MastraClientError)) return false;
  return (
    typeof error.body !== 'object' ||
    error.body === null ||
    !('code' in error.body) ||
    error.body.code === 'harness.event_replay_unavailable'
  );
}

function errorStatus(error: unknown): number | undefined {
  return typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : undefined;
}

function isAbortError(error: unknown): boolean {
  const candidate = error as { code?: unknown; name?: unknown };
  return (
    (typeof candidate.name === 'string' && candidate.name === 'AbortError') ||
    (typeof candidate.code === 'string' && candidate.code === 'ERR_ABORTED')
  );
}

async function delayUnlessClosed(ms: number, isClosed: () => boolean): Promise<void> {
  if (ms <= 0 || isClosed()) return;
  await new Promise<void>(resolve => {
    const timeout = setTimeout(resolve, ms);
    if (isClosed()) {
      clearTimeout(timeout);
      resolve();
    }
  });
}
