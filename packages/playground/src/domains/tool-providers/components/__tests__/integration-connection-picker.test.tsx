// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { IntegrationConnectionPicker } from '../integration-connection-picker';
import { makeConnection, noConnections, oneGmailConnection, twoGmailConnections } from './fixtures/connections';

const BASE_URL = 'http://localhost:4111';
const PROVIDER = 'composio';
const TOOLKIT = 'gmail';

interface HarnessFormValues {
  toolProviders: {
    [providerId: string]: {
      tools: Record<string, { toolkit: string }>;
      connections: Record<string, Array<{ kind: 'author'; toolkit: string; connectionId: string; scope?: string }>>;
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

interface HarnessProps {
  initial?: HarnessFormValues;
  children: ReactNode;
}

const Harness = ({ initial, children }: HarnessProps) => {
  const methods = useForm<HarnessFormValues>({
    defaultValues:
      initial ??
      ({
        toolProviders: {
          [PROVIDER]: { tools: {}, connections: {} },
        },
      } as HarnessFormValues),
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

describe('IntegrationConnectionPicker', () => {
  // Default `auth/me` so the new `useIsToolProviderAdmin` subscription does
  // not hit the real network under `onUnhandledRequest: 'bypass'`. Admin tests
  // override this via `server.use(...)`.
  const defaultHandlers = [
    http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester', permissions: [] })),
  ];
  const server = setupServer(...defaultHandlers);
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
  afterEach(() => {
    cleanup();
    server.resetHandlers(...defaultHandlers);
  });
  afterAll(() => server.close());

  it('renders the empty-state hint when no connections exist for the toolkit', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () => HttpResponse.json(noConnections)),
    );

    const { findByText } = render(
      <Harness>
        <IntegrationConnectionPicker providerId={PROVIDER} toolkit={TOOLKIT} multipleAllowed={true} />
      </Harness>,
    );

    expect(await findByText(/No connections yet/)).toBeTruthy();
  });

  it('lists only un-pinned connections in the Add menu', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () => HttpResponse.json(twoGmailConnections)),
    );

    const initial: HarnessFormValues = {
      toolProviders: {
        [PROVIDER]: {
          tools: {},
          connections: {
            [TOOLKIT]: [{ kind: 'author', toolkit: TOOLKIT, connectionId: 'conn_work', scope: 'per-author' }],
          },
        },
      },
    };

    const { getByTestId, queryByTestId, findByTestId } = render(
      <Harness initial={initial}>
        <IntegrationConnectionPicker providerId={PROVIDER} toolkit={TOOLKIT} multipleAllowed={true} />
      </Harness>,
    );

    // Wait for query to resolve.
    await findByTestId(`integration-connection-pinned-${PROVIDER}-${TOOLKIT}-conn_work`);

    fireEvent.click(getByTestId(`integration-connection-add-${PROVIDER}-${TOOLKIT}`));

    // Only the non-pinned conn appears.
    await waitFor(() => {
      expect(getByTestId(`integration-connection-pick-${PROVIDER}-${TOOLKIT}-conn_personal`)).toBeTruthy();
    });
    expect(queryByTestId(`integration-connection-pick-${PROVIDER}-${TOOLKIT}-conn_work`)).toBeNull();
  });

  it('picking a connection appends it to the form field', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () => HttpResponse.json(twoGmailConnections)),
    );

    const spy = vi.fn();
    const { getByTestId, findByTestId } = render(
      <Harness>
        <IntegrationConnectionPicker providerId={PROVIDER} toolkit={TOOLKIT} multipleAllowed={true} />
        <FormStateSpy onState={spy} />
      </Harness>,
    );

    fireEvent.click(getByTestId(`integration-connection-add-${PROVIDER}-${TOOLKIT}`));
    const pick = await findByTestId(`integration-connection-pick-${PROVIDER}-${TOOLKIT}-conn_personal`);
    fireEvent.click(pick);

    fireEvent.click(getByTestId('spy-form-state'));
    const state = spy.mock.calls[0][0] as HarnessFormValues;
    expect(state.toolProviders[PROVIDER].connections[TOOLKIT]).toEqual([
      { kind: 'author', toolkit: TOOLKIT, connectionId: 'conn_personal', scope: 'per-author' },
    ]);
  });

  it('disables the Add button when multipleAllowed is false and one is pinned', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () => HttpResponse.json(twoGmailConnections)),
    );

    const initial: HarnessFormValues = {
      toolProviders: {
        [PROVIDER]: {
          tools: {},
          connections: {
            [TOOLKIT]: [{ kind: 'author', toolkit: TOOLKIT, connectionId: 'conn_work', scope: 'per-author' }],
          },
        },
      },
    };

    const { findByTestId } = render(
      <Harness initial={initial}>
        <IntegrationConnectionPicker providerId={PROVIDER} toolkit={TOOLKIT} multipleAllowed={false} />
      </Harness>,
    );

    const addBtn = (await findByTestId(`integration-connection-add-${PROVIDER}-${TOOLKIT}`)) as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
  });

  it('removing a pinned row clears it from form state', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () => HttpResponse.json(oneGmailConnection)),
    );

    const initial: HarnessFormValues = {
      toolProviders: {
        [PROVIDER]: {
          tools: {},
          connections: {
            [TOOLKIT]: [{ kind: 'author', toolkit: TOOLKIT, connectionId: 'conn_only', scope: 'per-author' }],
          },
        },
      },
    };

    const spy = vi.fn();
    const { getByTestId, findByTestId } = render(
      <Harness initial={initial}>
        <IntegrationConnectionPicker providerId={PROVIDER} toolkit={TOOLKIT} multipleAllowed={true} />
        <FormStateSpy onState={spy} />
      </Harness>,
    );

    const removeBtn = await findByTestId(`integration-connection-remove-${PROVIDER}-${TOOLKIT}-conn_only`);
    fireEvent.click(removeBtn);

    fireEvent.click(getByTestId('spy-form-state'));
    const state = spy.mock.calls[0][0] as HarnessFormValues;
    expect(state.toolProviders[PROVIDER].connections[TOOLKIT]).toEqual([]);
  });

  it('shows an inline edit affordance on every pinned row', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () => HttpResponse.json(twoGmailConnections)),
    );

    const initial: HarnessFormValues = {
      toolProviders: {
        [PROVIDER]: {
          tools: {},
          connections: {
            [TOOLKIT]: [
              { kind: 'author', toolkit: TOOLKIT, connectionId: 'conn_work', scope: 'per-author' },
              { kind: 'author', toolkit: TOOLKIT, connectionId: 'conn_personal', scope: 'per-author' },
            ],
          },
        },
      },
    };

    const { findByTestId } = render(
      <Harness initial={initial}>
        <IntegrationConnectionPicker providerId={PROVIDER} toolkit={TOOLKIT} multipleAllowed={true} />
      </Harness>,
    );

    expect(await findByTestId(`integration-connection-label-edit-${PROVIDER}-${TOOLKIT}-conn_work`)).toBeTruthy();
    expect(await findByTestId(`integration-connection-label-edit-${PROVIDER}-${TOOLKIT}-conn_personal`)).toBeTruthy();
  });

  it('clicking edit + Save PATCHes the connection label and re-fetches', async () => {
    const patched = vi.fn();
    let listCallCount = 0;
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () => {
        listCallCount++;
        // First call returns the pre-rename label; subsequent calls (after
        // invalidation) return the renamed one.
        if (listCallCount === 1) {
          return HttpResponse.json(oneGmailConnection);
        }
        return HttpResponse.json({
          items: [
            {
              connectionId: 'conn_only',
              label: 'Work',
              status: 'connected',
              scope: 'per-author',
              toolkit: TOOLKIT,
            },
          ],
        });
      }),
      http.patch(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections/conn_only`, async ({ request }) => {
        const body = (await request.clone().json()) as { label: string | null };
        patched(body);
        return HttpResponse.json({ ok: true, label: body.label });
      }),
    );

    const initial: HarnessFormValues = {
      toolProviders: {
        [PROVIDER]: {
          tools: {},
          connections: {
            [TOOLKIT]: [{ kind: 'author', toolkit: TOOLKIT, connectionId: 'conn_only', scope: 'per-author' }],
          },
        },
      },
    };

    const { getByTestId, findByTestId } = render(
      <Harness initial={initial}>
        <IntegrationConnectionPicker providerId={PROVIDER} toolkit={TOOLKIT} multipleAllowed={true} />
      </Harness>,
    );

    const editBtn = await findByTestId(`integration-connection-label-edit-${PROVIDER}-${TOOLKIT}-conn_only`);
    fireEvent.click(editBtn);

    const input = (await findByTestId(
      `integration-connection-label-input-${PROVIDER}-${TOOLKIT}-conn_only`,
    )) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Work' } });

    fireEvent.click(getByTestId(`integration-connection-label-save-${PROVIDER}-${TOOLKIT}-conn_only`));

    await waitFor(() => {
      expect(patched).toHaveBeenCalledWith({ label: 'Work' });
    });
  });

  it('shows admin authorId suffix on pinned + menu rows when current user is admin', async () => {
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'me', permissions: ['tool-providers:admin'] })),
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () =>
        HttpResponse.json({
          items: [
            makeConnection('conn_work', { label: 'work', authorId: 'user_A' }),
            makeConnection('conn_personal', { label: 'personal', authorId: 'user_B' }),
          ],
        } satisfies typeof twoGmailConnections),
      ),
    );

    const initial: HarnessFormValues = {
      toolProviders: {
        [PROVIDER]: {
          tools: {},
          connections: {
            [TOOLKIT]: [{ kind: 'author', toolkit: TOOLKIT, connectionId: 'conn_work', scope: 'per-author' }],
          },
        },
      },
    };

    const { findByTestId, getByTestId, findByText } = render(
      <Harness initial={initial}>
        <IntegrationConnectionPicker providerId={PROVIDER} toolkit={TOOLKIT} multipleAllowed={true} />
      </Harness>,
    );

    // Pinned row shows the author suffix.
    const pinnedAuthor = await findByTestId(`integration-connection-author-${PROVIDER}-${TOOLKIT}-conn_work`);
    expect(pinnedAuthor.textContent).toContain('user_A');

    // Open the add-menu and assert the un-pinned conn shows its author suffix too.
    fireEvent.click(getByTestId(`integration-connection-add-${PROVIDER}-${TOOLKIT}`));
    expect(await findByText(/· user_B/)).toBeTruthy();
  });

  it('hides authorId suffix when current user is not admin', async () => {
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'me', permissions: [] })),
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () =>
        HttpResponse.json({
          items: [makeConnection('conn_work', { label: 'work', authorId: 'user_A' })],
        } satisfies typeof oneGmailConnection),
      ),
    );

    const initial: HarnessFormValues = {
      toolProviders: {
        [PROVIDER]: {
          tools: {},
          connections: {
            [TOOLKIT]: [{ kind: 'author', toolkit: TOOLKIT, connectionId: 'conn_work', scope: 'per-author' }],
          },
        },
      },
    };

    const { findByTestId, queryByTestId } = render(
      <Harness initial={initial}>
        <IntegrationConnectionPicker providerId={PROVIDER} toolkit={TOOLKIT} multipleAllowed={true} />
      </Harness>,
    );

    await findByTestId(`integration-connection-pinned-${PROVIDER}-${TOOLKIT}-conn_work`);
    expect(queryByTestId(`integration-connection-author-${PROVIDER}-${TOOLKIT}-conn_work`)).toBeNull();
  });

  it('Connect new account triggers the authorize popup', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () => HttpResponse.json(noConnections)),
      http.post(`${BASE_URL}/api/tool-providers/${PROVIDER}/authorize`, () =>
        HttpResponse.json({ url: 'https://oauth.example/authorize', authId: 'auth_abc' }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/auth-status/auth_abc`, () =>
        HttpResponse.json({ status: 'completed' }),
      ),
    );

    const openPopup = vi.fn().mockReturnValue({ close: vi.fn() });
    const originalOpen = window.open;
    window.open = openPopup as unknown as typeof window.open;

    try {
      const { getByTestId, findByTestId } = render(
        <Harness>
          <IntegrationConnectionPicker providerId={PROVIDER} toolkit={TOOLKIT} multipleAllowed={true} />
        </Harness>,
      );

      fireEvent.click(getByTestId(`integration-connection-add-${PROVIDER}-${TOOLKIT}`));
      const connectNew = await findByTestId(`integration-connection-connect-new-${PROVIDER}-${TOOLKIT}`);
      fireEvent.click(connectNew);

      await waitFor(() => {
        expect(openPopup).toHaveBeenCalledWith(
          'https://oauth.example/authorize',
          expect.any(String),
          expect.any(String),
        );
      });
    } finally {
      window.open = originalOpen;
    }
  });
});
