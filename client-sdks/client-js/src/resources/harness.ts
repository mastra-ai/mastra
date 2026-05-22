import type { HarnessEvent } from '@mastra/core/harness/v1';
import type { RequestContext } from '@mastra/core/request-context';
import type { Body, QueryParams, RouteResponse } from '../route-types.generated';
import type { ClientOptions } from '../types';
import { requestContextQueryString } from '../utils';
import { BaseResource } from './base';

export type HarnessListSessionsOptions = QueryParams<'GET /harness/:name/sessions'> & {
  requestContext?: RequestContext | Record<string, any>;
};

export type HarnessCreateSessionParams = Body<'POST /harness/:name/sessions'> & {
  requestContext?: RequestContext | Record<string, any>;
};

export type HarnessSessionSnapshot = RouteResponse<'GET /harness/:name/sessions/:sessionId'>;
export type HarnessListSessionsResponse = RouteResponse<'GET /harness/:name/sessions'>;
export type HarnessCreateSessionResponse = RouteResponse<'POST /harness/:name/sessions'>;
export type HarnessChannelDiagnosticsResponse =
  RouteResponse<'GET /harness/:name/sessions/:sessionId/channel-diagnostics'>;
export type HarnessAttachmentUploadBody = Body<'POST /harness/:name/sessions/:sessionId/attachments'>;
export type HarnessAttachmentUploadResponse = RouteResponse<'POST /harness/:name/sessions/:sessionId/attachments'>;
export type HarnessMessageBody = Body<'POST /harness/:name/sessions/:sessionId/messages'>;
export type HarnessMessageResponse = RouteResponse<'POST /harness/:name/sessions/:sessionId/messages'>;
export type HarnessQueueBody = Body<'POST /harness/:name/sessions/:sessionId/queue'>;
export type HarnessQueueResponse = RouteResponse<'POST /harness/:name/sessions/:sessionId/queue'>;
export type HarnessSignalBody = Body<'POST /harness/:name/sessions/:sessionId/signals'>;
export type HarnessSignalResponse = RouteResponse<'POST /harness/:name/sessions/:sessionId/signals'>;
export type HarnessOperationResult = RouteResponse<'GET /harness/:name/sessions/:sessionId/message-results/:signalId'>;
export type HarnessInboxResponseResult =
  RouteResponse<'GET /harness/:name/sessions/:sessionId/inbox-responses/:responseId/result'>;
export type HarnessStatePatch = Body<'PATCH /harness/:name/sessions/:sessionId/state'>;
export type HarnessModePatch = Body<'PATCH /harness/:name/sessions/:sessionId/mode'>;
export type HarnessModeResponse = RouteResponse<'PATCH /harness/:name/sessions/:sessionId/mode'>;
export type HarnessModelPatch = Body<'PATCH /harness/:name/sessions/:sessionId/model'>;
export type HarnessModelResponse = RouteResponse<'PATCH /harness/:name/sessions/:sessionId/model'>;
export type HarnessPermissionPatch = Body<'PATCH /harness/:name/sessions/:sessionId/permissions'>;
export type HarnessPermissionResponse = RouteResponse<'PATCH /harness/:name/sessions/:sessionId/permissions'>;
export type HarnessInboxResponseBody = Body<'POST /harness/:name/sessions/:sessionId/inbox/:itemId'>;
export type HarnessInboxResponse = RouteResponse<'POST /harness/:name/sessions/:sessionId/inbox/:itemId'>;
export type HarnessGoalBody = Body<'PUT /harness/:name/sessions/:sessionId/goal'>;
export type HarnessGoalResponse =
  | RouteResponse<'PUT /harness/:name/sessions/:sessionId/goal'>
  | RouteResponse<'GET /harness/:name/sessions/:sessionId/goal'>
  | RouteResponse<'POST /harness/:name/sessions/:sessionId/goal/pause'>
  | RouteResponse<'POST /harness/:name/sessions/:sessionId/goal/resume'>;

export interface HarnessEventStreamOptions {
  lastEventId?: string;
  requestContext?: RequestContext | Record<string, any>;
}

export interface HarnessPatchStateOptions {
  ifMatch: string | number;
  requestContext?: RequestContext | Record<string, any>;
}

export interface HarnessRequestOptions {
  requestContext?: RequestContext | Record<string, any>;
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value);
}

function appendQuery(
  path: string,
  query: Record<string, string | number | boolean | undefined>,
  requestContext?: RequestContext | Record<string, any>,
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }
  const queryString = searchParams.toString();
  return `${path}${queryString ? `?${queryString}` : ''}${requestContextQueryString(
    requestContext,
    queryString ? '&' : '?',
  )}`;
}

function parseSseBlock(block: string): HarnessEvent | null {
  const normalizedBlock = block.replace(/\r\n/g, '\n').trim();
  if (!normalizedBlock) {
    return null;
  }

  let eventId: string | undefined;
  const dataLines: string[] = [];
  for (const line of normalizedBlock.split('\n')) {
    if (line.startsWith('id:')) {
      eventId = line.slice('id:'.length).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim());
    }
  }
  const data = dataLines.join('\n');

  if (!data || data === '[DONE]') {
    return null;
  }

  const event = JSON.parse(data) as HarnessEvent;
  return eventId ? { ...event, id: eventId } : event;
}

function findSseBoundary(buffer: string): { index: number; length: number } | null {
  const lfIndex = buffer.indexOf('\n\n');
  const crlfIndex = buffer.indexOf('\r\n\r\n');

  if (lfIndex === -1 && crlfIndex === -1) {
    return null;
  }
  if (lfIndex === -1) {
    return { index: crlfIndex, length: 4 };
  }
  if (crlfIndex === -1 || lfIndex < crlfIndex) {
    return { index: lfIndex, length: 2 };
  }
  return { index: crlfIndex, length: 4 };
}

export class HarnessEventStream implements AsyncIterable<HarnessEvent> {
  private lastSeenEventId?: string;

  constructor(private response: Response) {}

  asResponse(): Response {
    return this.response;
  }

  get lastEventId(): string | undefined {
    return this.lastSeenEventId;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<HarnessEvent> {
    if (!this.response.body) {
      return;
    }

    const reader = this.response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let completed = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

        let boundary = findSseBoundary(buffer);
        while (boundary) {
          const block = buffer.slice(0, boundary.index);
          buffer = buffer.slice(boundary.index + boundary.length);
          const event = parseSseBlock(block);
          if (event) {
            this.lastSeenEventId = event.id;
            yield event;
          }
          boundary = findSseBoundary(buffer);
        }

        if (done) {
          break;
        }
      }

      const finalEvent = parseSseBlock(buffer);
      completed = true;
      if (finalEvent) {
        this.lastSeenEventId = finalEvent.id;
        yield finalEvent;
      }
    } finally {
      if (!completed) {
        await reader.cancel();
      }
      reader.releaseLock();
    }
  }
}

export class RemoteSession extends BaseResource {
  constructor(
    options: ClientOptions,
    private harnessName: string,
    private sessionId: string,
    private requestContext?: RequestContext | Record<string, any>,
  ) {
    super(options);
  }

  private get basePath(): string {
    return `/harness/${encodePathPart(this.harnessName)}/sessions/${encodePathPart(this.sessionId)}`;
  }

  private withContext(path: string, requestContext?: RequestContext | Record<string, any>): string {
    return `${path}${requestContextQueryString(requestContext ?? this.requestContext)}`;
  }

  snapshot(options: HarnessRequestOptions = {}): Promise<HarnessSessionSnapshot> {
    return this.request(this.withContext(this.basePath, options.requestContext));
  }

  get(options: HarnessRequestOptions = {}): Promise<HarnessSessionSnapshot> {
    return this.snapshot(options);
  }

  channelDiagnostics(
    options: QueryParams<'GET /harness/:name/sessions/:sessionId/channel-diagnostics'> & HarnessRequestOptions = {},
  ): Promise<HarnessChannelDiagnosticsResponse> {
    return this.request(
      appendQuery(
        `${this.basePath}/channel-diagnostics`,
        { limit: options.limit },
        options.requestContext ?? this.requestContext,
      ),
    );
  }

  uploadAttachment(
    body: HarnessAttachmentUploadBody,
    options: HarnessRequestOptions = {},
  ): Promise<HarnessAttachmentUploadResponse> {
    return this.request(this.withContext(`${this.basePath}/attachments`, options.requestContext), {
      method: 'POST',
      body,
    });
  }

  async deleteAttachment(attachmentId: string, options: HarnessRequestOptions = {}): Promise<void> {
    await this.request<Response>(
      this.withContext(`${this.basePath}/attachments/${encodePathPart(attachmentId)}`, options.requestContext),
      { method: 'DELETE', stream: true },
    );
  }

  message(body: HarnessMessageBody, options: HarnessRequestOptions = {}): Promise<HarnessMessageResponse> {
    return this.request(this.withContext(`${this.basePath}/messages`, options.requestContext), {
      method: 'POST',
      body,
    });
  }

  queue(body: HarnessQueueBody, options: HarnessRequestOptions = {}): Promise<HarnessQueueResponse> {
    return this.request(this.withContext(`${this.basePath}/queue`, options.requestContext), {
      method: 'POST',
      body,
    });
  }

  signal(body: HarnessSignalBody, options: HarnessRequestOptions = {}): Promise<HarnessSignalResponse> {
    return this.request(this.withContext(`${this.basePath}/signals`, options.requestContext), {
      method: 'POST',
      body,
    });
  }

  getMessageResult(signalId: string, options: HarnessRequestOptions = {}): Promise<HarnessOperationResult> {
    return this.request(
      this.withContext(`${this.basePath}/message-results/${encodePathPart(signalId)}`, options.requestContext),
    );
  }

  getQueueResult(queuedItemId: string, options: HarnessRequestOptions = {}): Promise<HarnessOperationResult> {
    return this.request(
      this.withContext(`${this.basePath}/queue/${encodePathPart(queuedItemId)}/result`, options.requestContext),
    );
  }

  getInboxResponseResult(responseId: string, options: HarnessRequestOptions = {}): Promise<HarnessInboxResponseResult> {
    return this.request(
      this.withContext(`${this.basePath}/inbox-responses/${encodePathPart(responseId)}/result`, options.requestContext),
    );
  }

  async events(options: HarnessEventStreamOptions = {}): Promise<HarnessEventStream> {
    const response = await this.request<Response>(this.withContext(`${this.basePath}/events`, options.requestContext), {
      method: 'GET',
      stream: true,
      ...(options.lastEventId ? { headers: { 'Last-Event-ID': options.lastEventId } } : {}),
    });

    return new HarnessEventStream(response);
  }

  getState(options: HarnessRequestOptions = {}): Promise<unknown> {
    return this.request(this.withContext(`${this.basePath}/state`, options.requestContext));
  }

  patchState(body: HarnessStatePatch, options: HarnessPatchStateOptions): Promise<unknown> {
    return this.request(this.withContext(`${this.basePath}/state`, options.requestContext), {
      method: 'PATCH',
      body,
      headers: { 'If-Match': `"${options.ifMatch}"` },
    });
  }

  switchMode(body: HarnessModePatch, options: HarnessRequestOptions = {}): Promise<HarnessModeResponse> {
    return this.request(this.withContext(`${this.basePath}/mode`, options.requestContext), {
      method: 'PATCH',
      body,
    });
  }

  switchModel(body: HarnessModelPatch, options: HarnessRequestOptions = {}): Promise<HarnessModelResponse> {
    return this.request(this.withContext(`${this.basePath}/model`, options.requestContext), {
      method: 'PATCH',
      body,
    });
  }

  updatePermissions(
    body: HarnessPermissionPatch,
    options: HarnessRequestOptions = {},
  ): Promise<HarnessPermissionResponse> {
    return this.request(this.withContext(`${this.basePath}/permissions`, options.requestContext), {
      method: 'PATCH',
      body,
    });
  }

  respondToInbox(
    itemId: string,
    body: HarnessInboxResponseBody,
    options: HarnessRequestOptions = {},
  ): Promise<HarnessInboxResponse> {
    return this.request(this.withContext(`${this.basePath}/inbox/${encodePathPart(itemId)}`, options.requestContext), {
      method: 'POST',
      body,
    });
  }

  setGoal(body: HarnessGoalBody, options: HarnessRequestOptions = {}): Promise<HarnessGoalResponse> {
    return this.request(this.withContext(`${this.basePath}/goal`, options.requestContext), {
      method: 'PUT',
      body,
    });
  }

  getGoal(options: HarnessRequestOptions = {}): Promise<HarnessGoalResponse> {
    return this.request(this.withContext(`${this.basePath}/goal`, options.requestContext));
  }

  pauseGoal(options: HarnessRequestOptions = {}): Promise<HarnessGoalResponse> {
    return this.request(this.withContext(`${this.basePath}/goal/pause`, options.requestContext), {
      method: 'POST',
    });
  }

  resumeGoal(options: HarnessRequestOptions = {}): Promise<HarnessGoalResponse> {
    return this.request(this.withContext(`${this.basePath}/goal/resume`, options.requestContext), {
      method: 'POST',
    });
  }

  async clearGoal(options: HarnessRequestOptions = {}): Promise<void> {
    await this.request<Response>(this.withContext(`${this.basePath}/goal`, options.requestContext), {
      method: 'DELETE',
      stream: true,
    });
  }

  async delete(options: HarnessRequestOptions = {}): Promise<void> {
    await this.request<Response>(this.withContext(this.basePath, options.requestContext), {
      method: 'DELETE',
      stream: true,
    });
  }
}

export class Harnesses extends BaseResource {
  constructor(options: ClientOptions) {
    super(options);
  }

  session(harnessName: string, sessionId: string, options: HarnessRequestOptions = {}): RemoteSession {
    return new RemoteSession(this.options, harnessName, sessionId, options.requestContext);
  }

  list(harnessName: string, options: HarnessListSessionsOptions = {}): Promise<HarnessListSessionsResponse> {
    return this.request(
      appendQuery(
        `/harness/${encodePathPart(harnessName)}/sessions`,
        {
          cursor: options.cursor,
          limit: options.limit,
          includeClosed: options.includeClosed,
        },
        options.requestContext,
      ),
    );
  }

  async create(harnessName: string, params: HarnessCreateSessionParams = {}): Promise<RemoteSession> {
    const { requestContext, ...body } = params;
    const response = await this.request<HarnessCreateSessionResponse>(
      appendQuery(`/harness/${encodePathPart(harnessName)}/sessions`, {}, requestContext),
      {
        method: 'POST',
        body,
      },
    );

    return new RemoteSession(this.options, harnessName, response.session.summary.sessionId, requestContext);
  }

  async createWithSnapshot(
    harnessName: string,
    params: HarnessCreateSessionParams = {},
  ): Promise<{ session: RemoteSession; snapshot: HarnessSessionSnapshot }> {
    const { requestContext, ...body } = params;
    const response = await this.request<HarnessCreateSessionResponse>(
      appendQuery(`/harness/${encodePathPart(harnessName)}/sessions`, {}, requestContext),
      {
        method: 'POST',
        body,
      },
    );

    return {
      session: new RemoteSession(this.options, harnessName, response.session.summary.sessionId, requestContext),
      snapshot: response.session,
    };
  }
}
