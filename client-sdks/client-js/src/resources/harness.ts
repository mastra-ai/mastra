import type {
  ClientOptions,
  CreateHarnessSessionParams,
  GetHarnessResponse,
  GetHarnessSessionResponse,
  ListHarnessesResponse,
  ListHarnessModesResponse,
  ListHarnessSessionsParams,
  ListHarnessSessionsResponse,
  SendHarnessMessageParams,
  SendHarnessMessageResponse,
} from '../types';

import { BaseResource } from './base';

export class HarnessSession extends BaseResource {
  constructor(
    options: ClientOptions,
    private harnessId: string,
    private sessionId: string,
  ) {
    super(options);
  }

  private sessionPath(suffix = '') {
    return `/harnesses/${this.harnessId}/sessions/${this.sessionId}${suffix}`;
  }

  private resourceIdQuery(resourceId?: string) {
    if (!resourceId) return '';
    return `?resourceId=${encodeURIComponent(resourceId)}`;
  }

  details(params?: { resourceId?: string }): Promise<GetHarnessSessionResponse> {
    return this.request(this.sessionPath(this.resourceIdQuery(params?.resourceId)));
  }

  switchMode(body: { modeId: string }, params?: { resourceId?: string }): Promise<GetHarnessSessionResponse> {
    return this.request(`${this.sessionPath('/mode')}${this.resourceIdQuery(params?.resourceId)}`, {
      method: 'POST',
      body,
    });
  }

  switchModel(body: { modelId: string }, params?: { resourceId?: string }): Promise<GetHarnessSessionResponse> {
    return this.request(`${this.sessionPath('/model')}${this.resourceIdQuery(params?.resourceId)}`, {
      method: 'POST',
      body,
    });
  }

  getThread(params?: { resourceId?: string }): Promise<{ thread: unknown | null }> {
    return this.request(this.sessionPath(`/thread${this.resourceIdQuery(params?.resourceId)}`));
  }

  getMessages(params?: { resourceId?: string }): Promise<{ messages: unknown[] }> {
    return this.request(this.sessionPath(`/messages${this.resourceIdQuery(params?.resourceId)}`));
  }

  sendMessage(body: SendHarnessMessageParams, params?: { resourceId?: string }): Promise<SendHarnessMessageResponse> {
    return this.request(`${this.sessionPath('/messages')}${this.resourceIdQuery(params?.resourceId)}`, {
      method: 'POST',
      body,
    });
  }

  queueMessage(body: SendHarnessMessageParams, params?: { resourceId?: string }): Promise<SendHarnessMessageResponse> {
    return this.request(`${this.sessionPath('/messages/queue')}${this.resourceIdQuery(params?.resourceId)}`, {
      method: 'POST',
      body,
    });
  }

  stream(body: SendHarnessMessageParams, params?: { resourceId?: string }): Promise<Response> {
    return this.request(`${this.sessionPath('/stream')}${this.resourceIdQuery(params?.resourceId)}`, {
      method: 'POST',
      body,
      stream: true,
    });
  }
}

export class Harness extends BaseResource {
  constructor(
    options: ClientOptions,
    private harnessId: string,
  ) {
    super(options);
  }

  details(): Promise<GetHarnessResponse> {
    return this.request(`/harnesses/${this.harnessId}`);
  }

  listModes(): Promise<ListHarnessModesResponse> {
    return this.request(`/harnesses/${this.harnessId}/modes`);
  }

  listSessions(params?: ListHarnessSessionsParams): Promise<ListHarnessSessionsResponse> {
    const query = new URLSearchParams();
    if (params?.resourceId) query.set('resourceId', params.resourceId);
    if (params?.threadId) query.set('threadId', params.threadId);
    const qs = query.toString();
    return this.request(`/harnesses/${this.harnessId}/sessions${qs ? `?${qs}` : ''}`);
  }

  createSession(body: CreateHarnessSessionParams): Promise<GetHarnessSessionResponse> {
    return this.request(`/harnesses/${this.harnessId}/sessions`, {
      method: 'POST',
      body,
    });
  }

  getSession(sessionId: string): HarnessSession {
    return new HarnessSession(this.options, this.harnessId, sessionId);
  }
}
