import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import {
  handleGitLabWebhook,
  normalizeGitLabWebhookMetadata,
  parseGitLabWebhook,
  verifyGitLabToken,
} from './webhook.js';

function context(options: { headers?: Record<string, string>; body?: string } = {}): Context {
  const headers = Object.fromEntries(
    Object.entries(options.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
  );
  return {
    req: {
      header: (name: string) => headers[name.toLowerCase()],
      text: async () => options.body ?? '{}',
    },
  } as unknown as Context;
}

const validContext = () =>
  context({
    headers: {
      'x-gitlab-event': 'Merge Request Hook',
      'x-gitlab-token': 'webhook-secret',
      'webhook-id': 'delivery-17',
      'x-gitlab-instance': 'https://gitlab.example.com',
    },
    body: JSON.stringify({ object_kind: 'merge_request', object_attributes: { iid: 17 } }),
  });

describe('verifyGitLabToken', () => {
  it('compares matching tokens and rejects content and length mismatches', () => {
    expect(verifyGitLabToken('webhook-secret', 'webhook-secret')).toBe(true);
    expect(verifyGitLabToken('webhook-secreu', 'webhook-secret')).toBe(false);
    expect(verifyGitLabToken('short', 'webhook-secret')).toBe(false);
  });
});

describe('parseGitLabWebhook', () => {
  it('rejects missing secret, event, token, and invalid token', async () => {
    await expect(parseGitLabWebhook(validContext(), undefined)).resolves.toMatchObject({ status: 401 });
    await expect(
      parseGitLabWebhook(context({ headers: { 'x-gitlab-token': 'webhook-secret' }, body: '{}' }), 'webhook-secret'),
    ).resolves.toMatchObject({ status: 400 });
    await expect(
      parseGitLabWebhook(context({ headers: { 'x-gitlab-event': 'Issue Hook' }, body: '{}' }), 'webhook-secret'),
    ).resolves.toMatchObject({ status: 401 });
    await expect(
      parseGitLabWebhook(
        context({
          headers: { 'x-gitlab-event': 'Issue Hook', 'x-gitlab-token': 'wrong-secret' },
          body: '{}',
        }),
        'webhook-secret',
      ),
    ).resolves.toMatchObject({ status: 401 });
  });

  it('rejects malformed and non-object JSON payloads', async () => {
    await expect(
      parseGitLabWebhook(
        context({
          headers: { 'x-gitlab-event': 'Issue Hook', 'x-gitlab-token': 'webhook-secret' },
          body: '{',
        }),
        'webhook-secret',
      ),
    ).resolves.toMatchObject({ status: 400, body: { message: 'Malformed JSON payload' } });
    await expect(
      parseGitLabWebhook(
        context({
          headers: { 'x-gitlab-event': 'Issue Hook', 'x-gitlab-token': 'webhook-secret' },
          body: '[]',
        }),
        'webhook-secret',
      ),
    ).resolves.toMatchObject({ status: 400, body: { message: 'Payload must be a JSON object' } });
  });

  it('returns the event, delivery identity, instance host, and object payload for a valid request', async () => {
    await expect(parseGitLabWebhook(validContext(), 'webhook-secret')).resolves.toEqual({
      event: 'Merge Request Hook',
      deliveryId: 'delivery-17',
      instanceHost: 'gitlab.example.com',
      payload: { object_kind: 'merge_request', object_attributes: { iid: 17 } },
    });
  });

  it('prefers a retry-stable idempotency key and otherwise derives a deterministic payload digest', async () => {
    const headers = {
      'x-gitlab-event': 'Issue Hook',
      'x-gitlab-token': 'webhook-secret',
      'idempotency-key': 'retry-key',
      'x-gitlab-event-uuid': 'event-uuid',
    };
    await expect(
      parseGitLabWebhook(context({ headers, body: '{"object_kind":"issue"}' }), 'webhook-secret'),
    ).resolves.toMatchObject({ deliveryId: 'retry-key' });

    const fallbackHeaders = { 'x-gitlab-event': 'Issue Hook', 'x-gitlab-token': 'webhook-secret' };
    const first = await parseGitLabWebhook(context({ headers: fallbackHeaders, body: '{}' }), 'webhook-secret');
    const replay = await parseGitLabWebhook(context({ headers: fallbackHeaders, body: '{}' }), 'webhook-secret');
    expect(first).toMatchObject({ deliveryId: expect.any(String) });
    expect(replay).toMatchObject({ deliveryId: (first as { deliveryId: string }).deliveryId });
  });
});

describe('normalizeGitLabWebhookMetadata', () => {
  it('extracts merge request project and sender metadata', () => {
    expect(
      normalizeGitLabWebhookMetadata({
        event: 'Merge Request Hook',
        deliveryId: 'delivery-17',
        payload: {
          project: { id: 101, path_with_namespace: 'acme/app' },
          object_attributes: { iid: 17 },
          user_username: 'alice',
        },
      }),
    ).toEqual({
      event: 'Merge Request Hook',
      projectId: 101,
      projectPath: 'acme/app',
      issueIid: undefined,
      mergeRequestIid: 17,
      noteableType: undefined,
      sender: 'alice',
    });
  });

  it('extracts note-on-merge-request metadata', () => {
    expect(
      normalizeGitLabWebhookMetadata({
        event: 'Note Hook',
        deliveryId: 'delivery-18',
        payload: {
          project: { id: 101, path_with_namespace: 'acme/app' },
          object_attributes: { noteable_type: 'MergeRequest' },
          merge_request: { iid: 17 },
          user: { username: 'bob' },
        },
      }),
    ).toMatchObject({
      projectId: 101,
      projectPath: 'acme/app',
      mergeRequestIid: 17,
      noteableType: 'MergeRequest',
      sender: 'bob',
    });
  });
});

describe('handleGitLabWebhook', () => {
  it('ignores unsupported events without forwarding them', async () => {
    const ingestFactoryEvent = vi.fn();
    const result = await handleGitLabWebhook(
      context({
        headers: { 'x-gitlab-event': 'Pipeline Hook', 'x-gitlab-token': 'webhook-secret' },
        body: '{}',
      }),
      { webhookSecret: 'webhook-secret', ingestFactoryEvent },
    );

    expect(result).toEqual({ status: 202, body: { ok: true, ignored: true } });
    expect(ingestFactoryEvent).not.toHaveBeenCalled();
  });

  it('forwards supported events and lets ingestion failures trigger a GitLab retry', async () => {
    const ingestFactoryEvent = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('failed'));

    await expect(
      handleGitLabWebhook(validContext(), { webhookSecret: 'webhook-secret', ingestFactoryEvent }),
    ).resolves.toEqual({ status: 202, body: { ok: true } });
    await expect(
      handleGitLabWebhook(validContext(), { webhookSecret: 'webhook-secret', ingestFactoryEvent }),
    ).rejects.toThrow('failed');
    expect(ingestFactoryEvent).toHaveBeenCalledTimes(2);
  });

  it('returns 401 for an invalid token', async () => {
    await expect(
      handleGitLabWebhook(
        context({
          headers: { 'x-gitlab-event': 'Issue Hook', 'x-gitlab-token': 'wrong' },
          body: '{}',
        }),
        { webhookSecret: 'webhook-secret' },
      ),
    ).resolves.toMatchObject({ status: 401 });
  });
});

describe('handleGitLabWebhook session dispatch', () => {
  const mergeHook = () =>
    context({
      headers: {
        'x-gitlab-event': 'Merge Request Hook',
        'x-gitlab-token': 'webhook-secret',
        'webhook-id': 'delivery-9',
      },
      body: JSON.stringify({
        object_kind: 'merge_request',
        user: { id: 7, username: 'ada' },
        project: { id: 101, path_with_namespace: 'acme/app', web_url: 'https://gitlab.example.com/acme/app' },
        object_attributes: { iid: 17, action: 'merge', url: 'https://gitlab.example.com/acme/app/-/merge_requests/17' },
      }),
    });

  it('delivers merge request activity to subscribed sessions after the rules ingress', async () => {
    const ingestFactoryEvent = vi.fn(async () => undefined);
    const send = vi.fn(async () => ({ record: { id: 'n-1' }, decision: { action: 'deliver' } }));
    const session = { thread: { getId: () => 'thread-1', switch: vi.fn() }, sendNotificationSignal: send };
    const retireSubscription = vi.fn(async () => undefined);
    const result = await handleGitLabWebhook(mergeHook(), {
      webhookSecret: 'webhook-secret',
      ingestFactoryEvent,
      controller: {
        queryThreadById: async () => ({ id: 'thread-1', resourceId: 'resource-1' }),
        getSessionByResource: async () => session,
      } as never,
      listSubscriptions: async () => [
        {
          id: 'sub-1',
          orgId: 'org-1',
          targetKey: 'change-request:gitlab:gitlab.example.com:101:17',
          sessionId: 'session-1',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          sessionScope: '',
          status: 'open',
          data: {
            host: 'gitlab.example.com',
            projectId: '101',
            projectPath: 'acme/app',
            projectRepositoryId: 'link-1',
            installationExternalId: 'direct',
            changeRequestId: '17',
            ownerId: 'u1',
            source: 'explicit-tool',
            subscribedByUserId: 'u1',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      retireSubscription,
    });

    expect(result).toEqual({ status: 202, body: { ok: true } });
    expect(ingestFactoryEvent).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'gitlab', kind: 'pull-request-merged' }),
      expect.objectContaining({ requestContext: expect.anything() }),
    );
    expect(retireSubscription).toHaveBeenCalledWith('sub-1', 'merged');
  });

  it('keeps the plain acknowledgement when no controller is mounted', async () => {
    await expect(handleGitLabWebhook(mergeHook(), { webhookSecret: 'webhook-secret' })).resolves.toEqual({
      status: 202,
      body: { ok: true },
    });
  });
});
