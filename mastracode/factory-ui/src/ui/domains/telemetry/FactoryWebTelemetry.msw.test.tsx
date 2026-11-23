import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { StrictMode } from 'react';
import { MemoryRouter, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import { queryKeys } from '../../../api/keys';
import type { FactoryAuthState } from '../auth/services/auth';
import { FactoryWebTelemetry } from './FactoryWebTelemetry';

let captured: unknown[];
const enabledAuth: FactoryAuthState = {
  authEnabled: true,
  authenticated: true,
  telemetryEnabled: true,
  user: { userId: 'user_123', organizationId: 'org_123', email: 'private@example.com' },
  provider: 'mastra-studio',
};

function Navigation() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate('/factories/private-factory/review?secret=private#hidden')}>Review</button>
      <button onClick={() => navigate('/factories/private-factory/work')}>Work</button>
      <input aria-label="Message" />
    </>
  );
}

function renderTelemetry(path = '/factories/private-factory/work?secret=private#hidden') {
  return renderWithProviders(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <FactoryWebTelemetry />
        <Navigation />
      </MemoryRouter>
    </StrictMode>,
  );
}

async function settle() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 350));
  });
}

beforeEach(() => {
  captured = [];
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () => HttpResponse.json(enabledAuth)),
    http.post(`${TEST_BASE_URL}/web/telemetry/activity`, async ({ request }) => {
      expect(request.credentials).toBe('include');
      captured.push(await request.json());
      return new HttpResponse(null, { status: 204 });
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Factory usage capture', () => {
  it('records one visible view under StrictMode without IDs, URLs, queries, or profile data', async () => {
    renderTelemetry();
    await waitFor(() => expect(captured).toEqual([{ activity: 'page_view', page: 'work' }]));
    await settle();
    expect(captured).toHaveLength(1);
    fireEvent.click(screen.getByText('Review'));
    await waitFor(() =>
      expect(captured).toEqual([
        { activity: 'page_view', page: 'work' },
        { activity: 'page_view', page: 'review' },
      ]),
    );
    fireEvent.click(screen.getByText('Work'));
    await waitFor(() => expect(captured).toHaveLength(3));
  });

  it('throttles pointer and keyboard interaction without reading input contents', async () => {
    renderTelemetry();
    await waitFor(() => expect(captured).toHaveLength(1));
    fireEvent.pointerDown(screen.getByLabelText('Message'));
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'private prompt' } });
    fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'a' });
    fireEvent.pointerDown(screen.getByLabelText('Message'));
    await waitFor(() =>
      expect(captured).toEqual([
        { activity: 'page_view', page: 'work' },
        { activity: 'interaction', page: 'work' },
      ]),
    );
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 60_001);
    fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'b' });
    await waitFor(() => expect(captured).toHaveLength(3));
    expect(captured[2]).toEqual({ activity: 'interaction', page: 'work' });
  });

  it('ignores hidden tabs and emits a pending view when the tab becomes visible', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const { client } = renderTelemetry();
    await waitForMutationsIdle(client);
    await settle();
    fireEvent.keyDown(document, { key: 'a' });
    expect(captured).toEqual([]);
    visibility.mockReturnValue('visible');
    fireEvent(document, new Event('visibilitychange'));
    await waitFor(() => expect(captured).toEqual([{ activity: 'page_view', page: 'work' }]));
    fireEvent(document, new Event('visibilitychange'));
    await settle();
    expect(captured).toHaveLength(1);
  });

  it.each([
    { ...enabledAuth, telemetryEnabled: false },
    { ...enabledAuth, telemetryEnabled: undefined },
    { ...enabledAuth, authenticated: false },
  ])('does not send requests unless the authenticated server explicitly enables them (%j)', async auth => {
    server.use(http.get(`${TEST_BASE_URL}/auth/me`, () => HttpResponse.json(auth)));
    const { client } = renderTelemetry();
    await waitForMutationsIdle(client);
    fireEvent.keyDown(document, { key: 'a' });
    await settle();
    expect(captured).toEqual([]);
  });

  it('does not carry the previous account throttle or keep capturing after logout', async () => {
    const { client } = renderTelemetry();
    await waitFor(() => expect(captured).toHaveLength(1));
    fireEvent.keyDown(document, { key: 'a' });
    await waitFor(() => expect(captured).toHaveLength(2));
    const other: FactoryAuthState = { ...enabledAuth, user: { userId: 'user_other' } };
    server.use(http.get(`${TEST_BASE_URL}/auth/me`, () => HttpResponse.json(other)));
    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.factoryAuth() });
    });
    await waitFor(() => expect(captured).toHaveLength(3));
    fireEvent.keyDown(document, { key: 'b' });
    await waitFor(() => expect(captured).toHaveLength(4));
    server.use(http.get(`${TEST_BASE_URL}/auth/me`, () => HttpResponse.json({ authenticated: false })));
    await act(async () => {
      await client.invalidateQueries({ queryKey: queryKeys.factoryAuth() });
    });
    fireEvent.keyDown(document, { key: 'c' });
    await settle();
    expect(captured).toHaveLength(4);
  });

  it('does not retry failed analytics requests or prevent navigation', async () => {
    const attempts = vi.fn();
    server.use(
      http.post(`${TEST_BASE_URL}/web/telemetry/activity`, () => {
        attempts();
        return HttpResponse.error();
      }),
    );
    renderTelemetry();
    await waitFor(() => expect(attempts).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText('Review'));
    await waitFor(() => expect(attempts).toHaveBeenCalledTimes(2));
    await settle();
    expect(attempts).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Message')).toBeInTheDocument();
  });

  it('ignores unknown and redirect-only routes', async () => {
    const { client } = renderTelemetry('/factories/private-factory/settings');
    await waitForMutationsIdle(client);
    await settle();
    fireEvent.keyDown(document, { key: 'a' });
    expect(captured).toEqual([]);
  });
});
