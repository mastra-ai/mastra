// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw-server';
import { ConnectionBadges } from '../connection-badges';
import { makeConnection, oneGmailConnection, twoGmailConnections } from './fixtures/connections';

const BASE_URL = 'http://localhost:4111';
const PROVIDER = 'composio';
const TOOLKIT = 'gmail';

interface HarnessFormValues {
  toolProviders: {
    [providerId: string]: {
      tools: Record<string, { toolkit: string }>;
      connections: Record<string, Array<{ kind: 'author'; toolkit: string; connectionId: string; label?: string; scope?: string }>>;
    };
  };
}

const FormStateSpy = ({ onState }: { onState: (state: HarnessFormValues) => void }) => {
  const methods = useFormContext<HarnessFormValues>();
  return (
    <button type="button" data-testid="spy-form-state" onClick={() => onState(methods.getValues())}>
      spy
    </button>
  );
};

const Harness = ({ children }: { children: ReactNode }) => {
  const methods = useForm<HarnessFormValues>({
    defaultValues: { toolProviders: { [PROVIDER]: { tools: {}, connections: {} } } } as HarnessFormValues,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <FormProvider {...methods}>{children}</FormProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('ConnectionBadges', () => {
  beforeEach(() => {
    server.use(http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester', permissions: [] })));
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('badge manage opens one card dialog and autosaves the new label', async () => {
    vi.useFakeTimers();
    const patched = vi.fn();
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () => HttpResponse.json(oneGmailConnection)),
      http.patch(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections/:connectionId`, async ({ request }) => {
        patched((await request.clone().json()) as { label: string | null });
        return HttpResponse.json({ ok: true });
      }),
    );

    const { findByTestId, findByText, queryByText, queryByTestId } = render(
      <Harness>
        <ConnectionBadges providerId={PROVIDER} toolkit={TOOLKIT} />
      </Harness>,
    );

    await findByTestId(`connection-badge-${PROVIDER}-${TOOLKIT}-conn_only`);
    expect(await findByText('only')).toBeTruthy();
    expect(queryByText('conn_only')).toBeNull();
    expect(queryByTestId(`connection-badge-edit-${PROVIDER}-${TOOLKIT}-conn_only`)).toBeNull();
    expect(queryByTestId(`connection-badge-disconnect-${PROVIDER}-${TOOLKIT}-conn_only`)).toBeNull();

    expect(document.querySelectorAll('[role="dialog"]').length).toBe(0);
    fireEvent.click(await findByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-conn_only`));
    expect(await findByText('Composio connection')).toBeTruthy();
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1);

    const input = (await findByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-input`)) as HTMLInputElement;
    expect(input.value).toBe('only');

    fireEvent.change(input, { target: { value: 'Work' } });
    expect(patched).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    await waitFor(() => expect(patched).toHaveBeenCalled());
    expect(patched).toHaveBeenLastCalledWith({ label: 'Work' });
    expect(queryByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-dialog`)).not.toBeNull();
    vi.useRealTimers();
  });

  it('clearing the label autosaves null from the manage dialog', async () => {
    vi.useFakeTimers();
    const patched = vi.fn();
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () => HttpResponse.json(oneGmailConnection)),
      http.patch(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections/:connectionId`, async ({ request }) => {
        patched((await request.clone().json()) as { label: string | null });
        return HttpResponse.json({ ok: true });
      }),
    );

    const { findByTestId } = render(
      <Harness>
        <ConnectionBadges providerId={PROVIDER} toolkit={TOOLKIT} />
      </Harness>,
    );

    fireEvent.click(await findByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-conn_only`));
    const input = (await findByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-input`)) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    await waitFor(() => expect(patched).toHaveBeenLastCalledWith({ label: null }));
  });

  it('badge shows a friendly placeholder (not the raw id) for an unnamed connection', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () =>
        HttpResponse.json({ items: [makeConnection('conn_unnamed')] }),
      ),
    );

    const { findByTestId, findByText, queryByText } = render(
      <Harness>
        <ConnectionBadges providerId={PROVIDER} toolkit={TOOLKIT} />
      </Harness>,
    );

    await findByTestId(`connection-badge-${PROVIDER}-${TOOLKIT}-conn_unnamed`);
    expect(await findByText('Unnamed connection')).toBeTruthy();
    expect(queryByText('conn_unnamed')).toBeNull();
  });

  it('disconnects from the manage dialog with force and unpins the selected connection', async () => {
    const deleted = vi.fn();
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () => HttpResponse.json(oneGmailConnection)),
      http.delete(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections/:connectionId`, ({ request, params }) => {
        deleted({ connectionId: params.connectionId, force: new URL(request.url).searchParams.get('force') });
        return HttpResponse.json({ ok: true });
      }),
    );

    let formState: HarnessFormValues | undefined;
    const { findByTestId, getByTestId, queryByTestId } = render(
      <Harness>
        <ConnectionBadges providerId={PROVIDER} toolkit={TOOLKIT} isChecked />
        <FormStateSpy onState={state => (formState = state)} />
      </Harness>,
    );

    await findByTestId(`connection-badge-${PROVIDER}-${TOOLKIT}-conn_only`);
    await waitFor(() => {
      fireEvent.click(getByTestId('spy-form-state'));
      expect(formState?.toolProviders?.[PROVIDER]?.connections?.[TOOLKIT]).toEqual([
        expect.objectContaining({ kind: 'author', toolkit: TOOLKIT, connectionId: 'conn_only' }),
      ]);
    });

    fireEvent.click(await findByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-conn_only`));
    await findByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-dialog`);
    fireEvent.click(await findByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-disconnect`));
    await findByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-disconnect-dialog`);
    expect(deleted).not.toHaveBeenCalled();
    fireEvent.click(await findByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-disconnect-confirm`));

    await waitFor(() => expect(deleted).toHaveBeenCalledWith({ connectionId: 'conn_only', force: 'true' }));
    await waitFor(() => expect(queryByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-dialog`)).toBeNull());
    fireEvent.click(getByTestId('spy-form-state'));
    expect(formState?.toolProviders?.[PROVIDER]?.connections?.[TOOLKIT]).toEqual([]);
  });

  it('disconnect alert can be cancelled without calling the API or closing manage', async () => {
    const deleted = vi.fn();
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () => HttpResponse.json(oneGmailConnection)),
      http.delete(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections/:connectionId`, () => {
        deleted();
        return HttpResponse.json({ ok: true });
      }),
    );

    const { findByTestId, queryByTestId } = render(
      <Harness>
        <ConnectionBadges providerId={PROVIDER} toolkit={TOOLKIT} />
      </Harness>,
    );

    fireEvent.click(await findByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-conn_only`));
    await findByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-dialog`);
    fireEvent.click(await findByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-disconnect`));
    await findByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-disconnect-dialog`);
    fireEvent.click(await findByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-disconnect-cancel`));

    await waitFor(() => expect(queryByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-disconnect-dialog`)).toBeNull());
    expect(queryByTestId(`connection-badge-manage-${PROVIDER}-${TOOLKIT}-dialog`)).not.toBeNull();
    expect(deleted).not.toHaveBeenCalled();
  });

  it('pins active connections with labels into the form when the tool is selected (badges = used)', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () => HttpResponse.json(twoGmailConnections)),
    );

    let formState: HarnessFormValues | undefined;
    const { findByTestId, getByTestId } = render(
      <Harness>
        <ConnectionBadges providerId={PROVIDER} toolkit={TOOLKIT} isChecked />
        <FormStateSpy onState={state => (formState = state)} />
      </Harness>,
    );

    await findByTestId(`connection-badge-${PROVIDER}-${TOOLKIT}-conn_work`);
    await findByTestId(`connection-badge-${PROVIDER}-${TOOLKIT}-conn_personal`);
    await waitFor(() => {
      fireEvent.click(getByTestId('spy-form-state'));
      expect(formState?.toolProviders?.[PROVIDER]?.connections?.[TOOLKIT]).toEqual([
        expect.objectContaining({ kind: 'author', toolkit: TOOLKIT, connectionId: 'conn_work', label: 'work' }),
        expect.objectContaining({ kind: 'author', toolkit: TOOLKIT, connectionId: 'conn_personal', label: 'personal' }),
      ]);
    });
  });

  it('does not pin connections while the tool is unselected', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () => HttpResponse.json(oneGmailConnection)),
    );

    let formState: HarnessFormValues | undefined;
    const { findByTestId, getByTestId } = render(
      <Harness>
        <ConnectionBadges providerId={PROVIDER} toolkit={TOOLKIT} />
        <FormStateSpy onState={state => (formState = state)} />
      </Harness>,
    );

    await findByTestId(`connection-badge-${PROVIDER}-${TOOLKIT}-conn_only`);
    fireEvent.click(getByTestId('spy-form-state'));
    expect(formState?.toolProviders?.[PROVIDER]?.connections?.[TOOLKIT] ?? []).toEqual([]);
  });
});
