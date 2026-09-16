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
    headers: { 'x-gitlab-event': 'Merge Request Hook', 'x-gitlab-token': 'webhook-secret' },
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
      parseGitLabWebhook(
        context({ headers: { 'x-gitlab-token': 'webhook-secret' }, body: '{}' }),
        'webhook-secret',
      ),
    ).resolves.toMatchObject({ status: 400 });
    await expect(
      parseGitLabWebhook(
        context({ headers: { 'x-gitlab-event': 'Issue Hook' }, body: '{}' }),
        'webhook-secret',
      ),
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

  it('returns the event and object payload for a valid request', async () => {
    await expect(parseGitLabWebhook(validContext(), 'webhook-secret')).resolves.toEqual({
      event: 'Merge Request Hook',
      payload: { object_kind: 'merge_request', object_attributes: { iid: 17 } },
    });
  });
});

describe('normalizeGitLabWebhookMetadata', () => {
  it('extracts merge request project and sender metadata', () => {
    expect(
      normalizeGitLabWebhookMetadata({
        event: 'Merge Request Hook',
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

  it('forwards supported events and acknowledges ingestion failures', async () => {
    const ingestFactoryEvent = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('failed'));

    await expect(
      handleGitLabWebhook(validContext(), { webhookSecret: 'webhook-secret', ingestFactoryEvent }),
    ).resolves.toEqual({ status: 202, body: { ok: true } });
    await expect(
      handleGitLabWebhook(validContext(), { webhookSecret: 'webhook-secret', ingestFactoryEvent }),
    ).resolves.toEqual({ status: 202, body: { ok: true } });
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
