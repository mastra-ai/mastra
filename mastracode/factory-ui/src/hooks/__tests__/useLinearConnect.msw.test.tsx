/**
 * Which way `useLinearConnect` connects a workspace, driven through the real
 * services and React Query cache with only the network mocked (MSW).
 */
import { act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { LinearStatus } from '../../ui/domains/factory/services/linear';
import { useLinearConnect } from '../useLinearConnect';

vi.mock('@nangohq/frontend', () => {
  class Nango {
    auth(integrationId: string) {
      return Promise.resolve({ connectionId: 'vendor-connection', providerConfigKey: integrationId });
    }
  }
  class AuthError extends Error {
    type = 'unknown';
  }
  return { default: Nango, AuthError };
});

const STATUS_URL = `${TEST_BASE_URL}/web/linear/status`;
const CONNECT_ROOT = `${TEST_BASE_URL}/web/integrations/platform/linear`;

const platformStatus: LinearStatus = {
  mode: 'platform',
  enabled: true,
  connected: false,
  workspace: null,
  reason: 'not_connected',
  workspaces: [],
};
const selfManagedStatus: LinearStatus = { enabled: true, connected: false, workspace: null, reason: 'not_connected' };

/** Answers the status endpoint with each reply in turn, repeating the last. */
function statusReplies(...replies: Array<LinearStatus | number>) {
  let calls = 0;
  server.use(
    http.get(STATUS_URL, () => {
      const reply = replies[Math.min(calls++, replies.length - 1)];
      return typeof reply === 'number'
        ? HttpResponse.json({ error: 'nope' }, { status: reply })
        : HttpResponse.json(reply);
    }),
  );
}

/** Mastra Connect sessions for Linear; `active: false` keeps the new connection unlisted. */
function connectSessions(active = true) {
  const minted: string[] = [];
  server.use(
    http.get(`${CONNECT_ROOT}/connections`, () =>
      HttpResponse.json({
        connections: active
          ? [{ id: 'linear-new', integrationId: 'linear', status: 'active', accountLabel: 'Linear' }]
          : [],
      }),
    ),
    http.post(`${CONNECT_ROOT}/connect-session`, () => {
      minted.push('linear-new');
      return HttpResponse.json(
        {
          connectionId: 'linear-new',
          integrationId: 'linear',
          connectUrl: 'https://example.com/consent',
          sessionToken: 'session-token',
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
        { status: 201 },
      );
    }),
  );
  return minted;
}

describe('useLinearConnect', () => {
  afterEach(() => vi.useRealTimers());

  it('connects through Mastra Connect when the status failed before but answers as a Platform server now', async () => {
    statusReplies(503, platformStatus);
    const minted = connectSessions();
    const { result } = renderHookWithProviders(() => useLinearConnect());

    await expect(result.current.connect()).resolves.toBe('done');

    expect(minted).toEqual(['linear-new']);
  });

  it.each([
    { why: "the server isn't answering", reply: 503 },
    { why: 'the session expired', reply: 401 },
  ])('fails instead of leaving for self-managed OAuth when $why', async ({ reply }) => {
    statusReplies(reply);
    const minted = connectSessions();
    const { result } = renderHookWithProviders(() => useLinearConnect());

    await expect(result.current.connect()).resolves.toBe('failed');

    expect(minted).toEqual([]);
  });

  it('leaves for its own OAuth flow on a self-managed server', async () => {
    statusReplies(selfManagedStatus);
    const minted = connectSessions();
    const beforeRedirect = vi.fn();
    const { result } = renderHookWithProviders(() => useLinearConnect());

    await expect(result.current.connect({ beforeRedirect })).resolves.toBe('redirecting');

    expect(beforeRedirect).toHaveBeenCalledOnce();
    expect(minted).toEqual([]);
  });

  it("reports a connection that hasn't turned active yet as activating, not done", async () => {
    statusReplies(platformStatus);
    connectSessions(false);
    const { result } = renderHookWithProviders(() => useLinearConnect());

    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'], shouldAdvanceTime: true });
    const outcome = result.current.connect();
    await act(() => vi.advanceTimersByTimeAsync(61_000));

    await expect(outcome).resolves.toBe('activating');
  });
});
