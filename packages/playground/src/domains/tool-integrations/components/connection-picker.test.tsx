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
  onChange?: (next: PickerConnection[]) => void;
}

const Harness = ({ initial, multipleAllowed = true, onChange }: HarnessProps) => {
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

  it('invokes the authorize flow with the existing connectionId when reauthorize is clicked', async () => {
    authorizeMock.mockResolvedValueOnce({ status: 'completed', connectionId: 'refreshed-1' });

    const onChange = vi.fn();
    renderPicker({
      initial: [{ connectionId: 'existing-1', toolService: TOOL_SERVICE, label: 'Work' }],
      onChange,
    });

    const button = screen.getByTestId(`connection-reauthorize-${TOOL_SERVICE}-0`);
    await act(async () => {
      fireEvent.click(button);
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

  it('removes a connection when the trash button is clicked', () => {
    const onChange = vi.fn();
    renderPicker({
      initial: [{ connectionId: 'c1', toolService: TOOL_SERVICE, label: 'Work' }],
      onChange,
    });
    fireEvent.click(screen.getByTestId(`connection-remove-${TOOL_SERVICE}-0`));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('lists unpinned existing connections and pins one with a fresh label', async () => {
    server.use(
      http.get(`${BASE_URL}/api/tool-integrations/${INTEGRATION_ID}/connections`, () =>
        HttpResponse.json({
          items: [
            { connectionId: 'ca_existing_1', toolService: TOOL_SERVICE, status: 'active' },
            { connectionId: 'ca_pinned', toolService: TOOL_SERVICE, status: 'active' },
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

    const labelInput = screen.getByTestId(
      `connection-existing-label-${TOOL_SERVICE}-ca_existing_1`,
    ) as HTMLInputElement;
    fireEvent.change(labelInput, { target: { value: 'Personal' } });

    fireEvent.click(screen.getByTestId(`connection-existing-pin-${TOOL_SERVICE}-ca_existing_1`));

    const lastCall = onChange.mock.calls.at(-1)?.[0] as PickerConnection[];
    expect(lastCall).toHaveLength(2);
    expect(lastCall[1]).toEqual({
      connectionId: 'ca_existing_1',
      toolService: TOOL_SERVICE,
      label: 'Personal',
    });
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
});
