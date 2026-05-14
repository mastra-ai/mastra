// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectionPicker } from './connection-picker';
import type { PickerConnection } from './connection-picker';

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
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the empty state when no connections are present', () => {
    renderPicker({ initial: [] });
    expect(screen.getByTestId(`connection-picker-${TOOL_SERVICE}-empty`)).toBeTruthy();
    expect(screen.getByText(/no connections yet/i)).toBeTruthy();
  });

  it('rejects empty labels inline', () => {
    renderPicker({
      initial: [{ connectionId: 'c1', toolService: TOOL_SERVICE, label: 'Work' }],
    });
    const input = screen.getByTestId(`connection-label-${TOOL_SERVICE}-0`) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByText(/label is required/i)).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
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
});
