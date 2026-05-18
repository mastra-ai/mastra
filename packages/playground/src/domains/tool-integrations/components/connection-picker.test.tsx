// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectionPicker } from './connection-picker';
import type { PickerConnection } from './connection-picker';
import { server } from '@/test/msw-server';

// Radix DropdownMenu relies on PointerEvent APIs jsdom doesn't implement.
if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

// Stub useAuthorize so tests don't need to drive the popup + polling loop.
const authorizeMock = vi.fn();
vi.mock('../hooks/use-authorize', () => ({
  useAuthorize: () => ({
    mutateAsync: authorizeMock,
    isPending: false,
  }),
}));

const BASE_URL = 'http://localhost:4111';
const INTEGRATION_ID = 'composio';
const TOOL_SERVICE = 'gmail';

interface HarnessProps {
  initial: PickerConnection[];
  multipleAllowed?: boolean;
  supportsRevoke?: boolean;
  onChange?: (next: PickerConnection[]) => void;
}

const Harness = ({ initial, multipleAllowed = true, supportsRevoke, onChange }: HarnessProps) => {
  const [connections, setConnections] = useState<PickerConnection[]>(initial);
  const handleChange = (next: PickerConnection[]) => {
    setConnections(next);
    onChange?.(next);
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ConnectionPicker
            integrationId={INTEGRATION_ID}
            toolService={TOOL_SERVICE}
            multipleAllowed={multipleAllowed}
            supportsRevoke={supportsRevoke}
            connections={connections}
            onChange={handleChange}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const renderPicker = (props: HarnessProps) => render(<Harness {...props} />);

describe('ConnectionPicker', () => {
  beforeEach(() => {
    authorizeMock.mockReset();
    // Default: no existing provider connections — keeps unrelated tests quiet
    // by satisfying the unconditional `useExistingConnections` query.
    server.use(
      http.get(`${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connections`, () =>
        HttpResponse.json({ items: [] }),
      ),
      // No provider-specific fields by default — keeps the picker tests
      // quiet by satisfying the unconditional `useConnectionFields` query.
      http.get(`${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connection-fields`, () =>
        HttpResponse.json({ fields: [] }),
      ),
      // Default: non-admin caller. Individual tests override these to grant
      // `tool-integrations:admin` and to set the caller id.
      http.get(`${BASE_URL}/api/auth/capabilities`, () =>
        HttpResponse.json({
          enabled: true,
          capabilities: { rbac: true },
          user: { id: 'caller-1', email: 'a@example.com', name: 'A' },
          access: { roles: [], permissions: [] },
        }),
      ),
      http.get(`${BASE_URL}/api/auth/me`, () =>
        HttpResponse.json({ id: 'caller-1', email: 'a@example.com', name: 'A' }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the empty state when no connections are present', () => {
    renderPicker({ initial: [] });
    expect(screen.getByTestId(`connection-picker-${TOOL_SERVICE}-empty`)).toBeTruthy();
    expect(screen.getByText(/no connections yet/i)).toBeTruthy();
  });

  it('does not require a label when there is only one connection', () => {
    renderPicker({
      initial: [{ connectionId: 'c1', toolService: TOOL_SERVICE, label: 'Work' }],
    });
    const input = screen.getByTestId(`connection-label-${TOOL_SERVICE}-0`) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.queryByText(/label is required/i)).toBeNull();
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
  });

  it('requires a non-empty label on every row once a second connection is added', () => {
    renderPicker({
      initial: [
        { connectionId: 'c1', toolService: TOOL_SERVICE },
        { connectionId: 'c2', toolService: TOOL_SERVICE, label: 'Personal' },
      ],
    });
    expect(screen.getByText(/label is required when you have multiple connections/i)).toBeTruthy();
    expect(
      (screen.getByTestId(`connection-label-${TOOL_SERVICE}-0`) as HTMLInputElement).getAttribute('aria-invalid'),
    ).toBe('true');
  });

  it('hides the label input on the single-connection happy path', () => {
    renderPicker({
      initial: [{ connectionId: 'c1', toolService: TOOL_SERVICE }],
    });
    expect(screen.queryByTestId(`connection-label-${TOOL_SERVICE}-0`)).toBeNull();
    expect(screen.getByTestId(`connection-summary-${TOOL_SERVICE}-0`)).toBeTruthy();
  });

  it('rejects case-insensitive duplicate labels inline', () => {
    renderPicker({
      initial: [
        { connectionId: 'c1', toolService: TOOL_SERVICE, label: 'Work' },
        { connectionId: 'c2', toolService: TOOL_SERVICE, label: 'work' },
      ],
    });
    expect(screen.getByText(/duplicate label/i)).toBeTruthy();
  });

  it('renders single-select (no "Add connection" button) when multipleAllowed is false', () => {
    renderPicker({
      initial: [{ connectionId: 'c1', toolService: TOOL_SERVICE, label: 'Primary' }],
      multipleAllowed: false,
    });
    expect(screen.queryByTestId(`connection-add-${TOOL_SERVICE}`)).toBeNull();
  });

  it('hides the "Add connection" button when single-select already has a connection', () => {
    renderPicker({
      initial: [{ connectionId: 'c1', toolService: TOOL_SERVICE, label: 'Primary' }],
      multipleAllowed: false,
    });
    expect(screen.queryByRole('button', { name: /add connection/i })).toBeNull();
  });

  const openKebab = async (index: number) => {
    const trigger = screen.getByTestId(`connection-actions-${TOOL_SERVICE}-${index}`);
    // Radix DropdownMenu opens on pointerdown for mouse input; jsdom's
    // `click` doesn't synthesize that. Keyboard (Enter/Space on the focused
    // trigger) is the supported a11y path and works in jsdom.
    await act(async () => {
      trigger.focus();
      fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' });
    });
  };

  it('invokes the authorize flow with the existing connectionId when reauthorize is selected', async () => {
    authorizeMock.mockResolvedValueOnce({ status: 'completed', connectionId: 'refreshed-1' });

    const onChange = vi.fn();
    renderPicker({
      initial: [{ connectionId: 'existing-1', toolService: TOOL_SERVICE, label: 'Work' }],
      onChange,
    });

    await openKebab(0);
    const reauth = await screen.findByTestId(`connection-reauthorize-${TOOL_SERVICE}-0`);
    await act(async () => {
      fireEvent.click(reauth);
    });

    await waitFor(() => {
      expect(authorizeMock).toHaveBeenCalledWith({
        integrationId: INTEGRATION_ID,
        toolService: TOOL_SERVICE,
        connectionId: 'existing-1',
      });
    });
    const lastCall = onChange.mock.calls.at(-1)?.[0] as PickerConnection[];
    expect(lastCall).toHaveLength(1);
    expect(lastCall[0].label).toBe('Work');
    expect(lastCall[0].connectionId).toBe('refreshed-1');
  });

  it('unpins a connection from the agent via the kebab menu', async () => {
    const onChange = vi.fn();
    renderPicker({
      initial: [{ connectionId: 'c1', toolService: TOOL_SERVICE, label: 'Work' }],
      onChange,
    });
    await openKebab(0);
    const unpin = await screen.findByTestId(`connection-unpin-${TOOL_SERVICE}-0`);
    await act(async () => {
      fireEvent.click(unpin);
    });
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('lists unpinned existing connections and pins one inheriting its persisted label', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connections`, () =>
        HttpResponse.json({
          items: [
            { connectionId: 'ca_existing_1', toolService: TOOL_SERVICE, status: 'active', label: 'Personal' },
            { connectionId: 'ca_pinned', toolService: TOOL_SERVICE, status: 'active', label: 'Already' },
          ],
        }),
      ),
    );

    const onChange = vi.fn();
    renderPicker({
      initial: [{ connectionId: 'ca_pinned', toolService: TOOL_SERVICE, label: 'Already' }],
      onChange,
    });

    await waitFor(() => {
      expect(screen.getByTestId(`connection-existing-${TOOL_SERVICE}-ca_existing_1`)).toBeTruthy();
    });
    // Already-pinned connection should NOT appear in the existing list.
    expect(screen.queryByTestId(`connection-existing-${TOOL_SERVICE}-ca_pinned`)).toBeNull();

    fireEvent.click(screen.getByTestId(`connection-existing-pin-${TOOL_SERVICE}-ca_existing_1`));

    const lastCall = onChange.mock.calls.at(-1)?.[0] as PickerConnection[];
    expect(lastCall).toHaveLength(2);
    expect(lastCall[1]).toEqual({
      connectionId: 'ca_existing_1',
      toolService: TOOL_SERVICE,
      label: 'Personal',
    });
  });

  it('pins an existing connection with no label when none are pinned yet', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connections`, () =>
        HttpResponse.json({
          items: [{ connectionId: 'ca_existing_1', toolService: TOOL_SERVICE, status: 'active' }],
        }),
      ),
    );

    const onChange = vi.fn();
    renderPicker({ initial: [], onChange });

    await waitFor(() => {
      expect(screen.getByTestId(`connection-existing-${TOOL_SERVICE}-ca_existing_1`)).toBeTruthy();
    });

    const pinButton = screen.getByTestId(`connection-existing-pin-${TOOL_SERVICE}-ca_existing_1`) as HTMLButtonElement;
    expect(pinButton.disabled).toBe(false);

    fireEvent.click(pinButton);

    const lastCall = onChange.mock.calls.at(-1)?.[0] as PickerConnection[];
    expect(lastCall).toHaveLength(1);
    expect(lastCall[0]).toEqual({ connectionId: 'ca_existing_1', toolService: TOOL_SERVICE });
  });

  it('collects provider-specific fields before initiating OAuth', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connection-fields`, () =>
        HttpResponse.json({
          fields: [
            {
              name: 'subdomain',
              displayName: 'Subdomain',
              description: 'Your workspace subdomain',
              type: 'string',
              required: true,
            },
          ],
        }),
      ),
    );
    authorizeMock.mockResolvedValue({ status: 'completed', connectionId: 'ca_new' });

    const onChange = vi.fn();
    renderPicker({ initial: [], onChange });

    // Let react-query settle so `useConnectionFields` has resolved before we
    // exercise the Connect button — otherwise the picker thinks there are
    // no provider fields and goes straight to OAuth.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await waitFor(() => {
      expect(screen.getByTestId(`connection-picker-${TOOL_SERVICE}-empty`)).toBeTruthy();
    });

    // First click opens the inline field form rather than calling authorize.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /connect/i }));
    });
    await waitFor(() => {
      expect(screen.getByTestId(`connection-picker-${TOOL_SERVICE}-fields`)).toBeTruthy();
    });
    expect(authorizeMock).not.toHaveBeenCalled();

    // Fill the required field and submit.
    const subdomain = screen.getByTestId(`connection-field-${TOOL_SERVICE}-subdomain`) as HTMLInputElement;
    fireEvent.change(subdomain, { target: { value: 'acme' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /connect/i }));
    });

    await waitFor(() => {
      expect(authorizeMock).toHaveBeenCalledWith({
        integrationId: INTEGRATION_ID,
        toolService: TOOL_SERVICE,
        config: { subdomain: 'acme' },
      });
    });
    const lastCall = onChange.mock.calls.at(-1)?.[0] as PickerConnection[];
    expect(lastCall).toHaveLength(1);
    expect(lastCall[0].connectionId).toBe('ca_new');
  });

  it('hides the existing-connections section in single-select once pinned', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connections`, () =>
        HttpResponse.json({
          items: [{ connectionId: 'ca_other', toolService: TOOL_SERVICE, status: 'active' }],
        }),
      ),
    );

    renderPicker({
      initial: [{ connectionId: 'ca_pinned', toolService: TOOL_SERVICE, label: 'Primary' }],
      multipleAllowed: false,
    });

    await waitFor(() => {
      expect(screen.queryByTestId(`connection-picker-${TOOL_SERVICE}-existing`)).toBeNull();
    });
  });

  it('shows a label input in the empty state and forwards the typed label to authorize', async () => {
    authorizeMock.mockResolvedValue({ status: 'completed', connectionId: 'ca_new' });

    const onChange = vi.fn();
    renderPicker({ initial: [], onChange });

    const labelInput = screen.getByTestId(`connection-new-label-${TOOL_SERVICE}`) as HTMLInputElement;
    fireEvent.change(labelInput, { target: { value: 'Work account' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /connect/i }));
    });

    await waitFor(() => {
      expect(authorizeMock).toHaveBeenCalledWith({
        integrationId: INTEGRATION_ID,
        toolService: TOOL_SERVICE,
        label: 'Work account',
      });
    });

    const lastCall = onChange.mock.calls.at(-1)?.[0] as PickerConnection[];
    expect(lastCall).toHaveLength(1);
    expect(lastCall[0]).toEqual({
      connectionId: 'ca_new',
      toolService: TOOL_SERVICE,
      label: 'Work account',
    });
  });

  it('allows connecting with no label when none is typed in the empty state', async () => {
    authorizeMock.mockResolvedValue({ status: 'completed', connectionId: 'ca_new' });
    renderPicker({ initial: [] });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /connect/i }));
    });

    await waitFor(() => {
      expect(authorizeMock).toHaveBeenCalledWith({
        integrationId: INTEGRATION_ID,
        toolService: TOOL_SERVICE,
      });
    });
  });

  it('surfaces persisted labels from listConnections as static read-only text on the existing-connections row', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connections`, () =>
        HttpResponse.json({
          items: [{ connectionId: 'ca_existing_1', toolService: TOOL_SERVICE, status: 'active', label: 'Saved label' }],
        }),
      ),
    );

    renderPicker({ initial: [] });

    const labelNode = await screen.findByTestId(`connection-existing-label-${TOOL_SERVICE}-ca_existing_1`);

    expect(labelNode.tagName).not.toBe('INPUT');
    expect(labelNode.textContent).toContain('Saved label');
  });

  it('inherits the persisted label when pinning a second existing connection with no override', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connections`, () =>
        HttpResponse.json({
          items: [
            { connectionId: 'ca_first', toolService: TOOL_SERVICE, status: 'active', label: 'Work' },
            { connectionId: 'ca_second', toolService: TOOL_SERVICE, status: 'active', label: 'Personal' },
          ],
        }),
      ),
    );

    const onChange = vi.fn();
    renderPicker({
      initial: [{ connectionId: 'ca_first', toolService: TOOL_SERVICE, label: 'Work' }],
      onChange,
    });

    await screen.findByTestId(`connection-existing-${TOOL_SERVICE}-ca_second`);
    const pinBtn = screen.getByTestId(`connection-existing-pin-${TOOL_SERVICE}-ca_second`) as HTMLButtonElement;
    // Even though we already have one pinned (so labels are required for the
    // multi-connection scenario), the persisted label "Personal" should be
    // inherited without making the user retype it.
    expect(pinBtn.disabled).toBe(false);

    fireEvent.click(pinBtn);

    const lastCall = onChange.mock.calls.at(-1)?.[0] as PickerConnection[];
    expect(lastCall).toHaveLength(2);
    expect(lastCall[1]).toEqual({
      connectionId: 'ca_second',
      toolService: TOOL_SERVICE,
      label: 'Personal',
    });
  });

  it('inherits the persisted label when pinning an existing connection with no override', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connections`, () =>
        HttpResponse.json({
          items: [{ connectionId: 'ca_existing_1', toolService: TOOL_SERVICE, status: 'active', label: 'Saved label' }],
        }),
      ),
    );

    const onChange = vi.fn();
    renderPicker({ initial: [], onChange });

    await screen.findByTestId(`connection-existing-${TOOL_SERVICE}-ca_existing_1`);
    fireEvent.click(screen.getByTestId(`connection-existing-pin-${TOOL_SERVICE}-ca_existing_1`));

    const lastCall = onChange.mock.calls.at(-1)?.[0] as PickerConnection[];
    expect(lastCall).toHaveLength(1);
    // No override typed → pin inherits persisted label so it carries across agents.
    expect(lastCall[0].label).toBe('Saved label');
    expect(lastCall[0].connectionId).toBe('ca_existing_1');
  });

  it('hides the Disconnect menu item when the integration does not support revoke', async () => {
    renderPicker({
      initial: [{ connectionId: 'c1', toolService: TOOL_SERVICE, label: 'Work' }],
      supportsRevoke: false,
    });

    await openKebab(0);
    await screen.findByTestId(`connection-unpin-${TOOL_SERVICE}-0`);
    expect(screen.queryByTestId(`connection-disconnect-${TOOL_SERVICE}-0`)).toBeNull();
  });

  it('confirms disconnect with the usage count and calls DELETE with force=true', async () => {
    const deleteRequests: Array<{ connectionId: string; url: string }> = [];
    server.use(
      http.get(`${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connections/:connectionId/usage`, () =>
        HttpResponse.json({
          agents: [
            { id: 'a1', name: 'Other agent' },
            { id: 'a2', name: 'Another' },
          ],
        }),
      ),
      http.delete(
        `${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connections/:connectionId`,
        ({ params, request }) => {
          deleteRequests.push({ connectionId: String(params.connectionId), url: request.url });
          return HttpResponse.json({ connectionId: params.connectionId });
        },
      ),
    );

    const onChange = vi.fn();
    renderPicker({
      initial: [{ connectionId: 'c1', toolService: TOOL_SERVICE, label: 'Work' }],
      supportsRevoke: true,
      onChange,
    });

    await openKebab(0);
    const disconnectItem = await screen.findByTestId(`connection-disconnect-${TOOL_SERVICE}-0`);
    await act(async () => {
      fireEvent.click(disconnectItem);
    });

    const usage = await screen.findByTestId(`connection-disconnect-usage-${TOOL_SERVICE}`);
    await waitFor(() => {
      expect(usage.textContent).toContain('2');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId(`connection-disconnect-confirm-${TOOL_SERVICE}`));
    });

    await waitFor(() => {
      expect(deleteRequests).toHaveLength(1);
    });
    expect(deleteRequests[0].connectionId).toBe('c1');
    expect(deleteRequests[0].url).toContain('force=true');

    const lastCall = onChange.mock.calls.at(-1)?.[0] as PickerConnection[];
    expect(lastCall).toEqual([]);
  });

  it('hides the author filter dropdown for non-admin callers', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connections`, () =>
        HttpResponse.json({
          items: [{ connectionId: 'c1', toolService: TOOL_SERVICE, status: 'active', label: 'Work' }],
        }),
      ),
    );
    renderPicker({ initial: [] });
    await screen.findByTestId(`connection-picker-${TOOL_SERVICE}-existing`);
    expect(screen.queryByTestId(`connection-author-filter-${TOOL_SERVICE}`)).toBeNull();
  });

  it('renders the author filter for admin callers and forwards authorId when set to Mine', async () => {
    const listRequests: Array<URL> = [];
    server.use(
      http.get(`${BASE_URL}/api/auth/capabilities`, () =>
        HttpResponse.json({
          enabled: true,
          capabilities: { rbac: true },
          user: { id: 'admin-1', email: 'admin@example.com', name: 'Admin' },
          access: { roles: ['admin'], permissions: ['tool-integrations:admin'] },
        }),
      ),
      http.get(`${BASE_URL}/api/auth/me`, () =>
        HttpResponse.json({ id: 'admin-1', email: 'admin@example.com', name: 'Admin' }),
      ),
      http.get(`${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connections`, ({ request }) => {
        listRequests.push(new URL(request.url));
        return HttpResponse.json({
          items: [
            { connectionId: 'c1', toolService: TOOL_SERVICE, status: 'active', label: 'Work', authorId: 'admin-1' },
          ],
        });
      }),
    );
    renderPicker({ initial: [] });
    const trigger = await screen.findByTestId(`connection-author-filter-${TOOL_SERVICE}`);
    expect(trigger.textContent).toContain('Mine');
    await waitFor(() => {
      expect(listRequests.some(u => u.searchParams.get('authorId') === 'admin-1')).toBe(true);
    });
  });

  it('switches admin filter to All authors and refetches without authorId', async () => {
    const listRequests: Array<URL> = [];
    server.use(
      http.get(`${BASE_URL}/api/auth/capabilities`, () =>
        HttpResponse.json({
          enabled: true,
          capabilities: { rbac: true },
          user: { id: 'admin-1', email: 'a@a', name: 'A' },
          access: { roles: ['admin'], permissions: ['tool-integrations:admin'] },
        }),
      ),
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'admin-1', email: 'a@a', name: 'A' })),
      http.get(`${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connections`, ({ request }) => {
        const url = new URL(request.url);
        listRequests.push(url);
        const authorId = url.searchParams.get('authorId');
        if (!authorId) {
          return HttpResponse.json({
            items: [
              { connectionId: 'c1', toolService: TOOL_SERVICE, status: 'active', label: 'Work', authorId: 'admin-1' },
              { connectionId: 'c2', toolService: TOOL_SERVICE, status: 'active', label: 'Bob', authorId: 'user-bob' },
            ],
          });
        }
        return HttpResponse.json({
          items: [
            { connectionId: 'c1', toolService: TOOL_SERVICE, status: 'active', label: 'Work', authorId: 'admin-1' },
          ],
        });
      }),
    );
    renderPicker({ initial: [] });
    const trigger = await screen.findByTestId(`connection-author-filter-${TOOL_SERVICE}`);
    trigger.focus();
    await act(async () => {
      fireEvent.keyDown(trigger, { key: 'Enter' });
    });
    const allItem = await screen.findByTestId(`connection-author-filter-${TOOL_SERVICE}-all`);
    await act(async () => {
      fireEvent.click(allItem);
    });
    await waitFor(() => {
      const last = listRequests.at(-1)!;
      expect(last.searchParams.get('authorId')).toBeNull();
    });
    // Cross-author row renders an owner badge.
    await screen.findByTestId(`connection-existing-owner-${TOOL_SERVICE}-c2`);
    // Caller's own row does NOT render an owner badge.
    expect(screen.queryByTestId(`connection-existing-owner-${TOOL_SERVICE}-c1`)).toBeNull();
  });

  it('renders a Load more button when nextCursor is returned and appends fetched rows', async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connections`, ({ request }) => {
        const url = new URL(request.url);
        const cursor = url.searchParams.get('cursor');
        calls += 1;
        if (!cursor) {
          return HttpResponse.json({
            items: [{ connectionId: 'c1', toolService: TOOL_SERVICE, status: 'active', label: 'Work' }],
            nextCursor: 'page-2',
          });
        }
        return HttpResponse.json({
          items: [{ connectionId: 'c2', toolService: TOOL_SERVICE, status: 'active', label: 'Personal' }],
        });
      }),
    );
    renderPicker({ initial: [] });
    const loadMore = await screen.findByTestId(`connection-existing-load-more-${TOOL_SERVICE}`);
    await act(async () => {
      fireEvent.click(loadMore);
    });
    await screen.findByTestId(`connection-existing-${TOOL_SERVICE}-c2`);
    expect(calls).toBeGreaterThanOrEqual(2);
    // Load more button disappears once the server stops returning a cursor.
    await waitFor(() => {
      expect(screen.queryByTestId(`connection-existing-load-more-${TOOL_SERVICE}`)).toBeNull();
    });
  });

  it('surfaces the owner in the disconnect confirm dialog when the target is cross-author', async () => {
    server.use(
      http.get(`${BASE_URL}/api/auth/capabilities`, () =>
        HttpResponse.json({
          enabled: true,
          capabilities: { rbac: true },
          user: { id: 'admin-1', email: 'a@a', name: 'A' },
          access: { roles: ['admin'], permissions: ['tool-integrations:admin'] },
        }),
      ),
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'admin-1', email: 'a@a', name: 'A' })),
      http.get(`${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connections`, () =>
        HttpResponse.json({
          items: [
            { connectionId: 'c1', toolService: TOOL_SERVICE, status: 'active', label: 'Work', authorId: 'user-bob' },
          ],
        }),
      ),
      http.get(`${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connections/:connectionId/usage`, () =>
        HttpResponse.json({ agents: [] }),
      ),
    );
    renderPicker({
      initial: [{ connectionId: 'c1', toolService: TOOL_SERVICE, label: 'Work' }],
      supportsRevoke: true,
    });

    const trigger = screen.getByTestId(`connection-actions-${TOOL_SERVICE}-0`);
    trigger.focus();
    await act(async () => {
      fireEvent.keyDown(trigger, { key: 'Enter' });
    });
    const disconnectItem = await screen.findByTestId(`connection-disconnect-${TOOL_SERVICE}-0`);
    await act(async () => {
      fireEvent.click(disconnectItem);
    });
    const owner = await screen.findByTestId(`connection-disconnect-owner-${TOOL_SERVICE}`);
    expect(owner.textContent).toContain('user-bob');
  });
});
