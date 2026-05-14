// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AddToolsDialog } from './add-tools-dialog';
import type { AddToolsDialogSelection } from './add-tools-dialog';

const useToolIntegrationsMock = vi.fn();
const useToolsMock = vi.fn();

vi.mock('../hooks/use-tool-integrations', () => ({
  useToolIntegrations: () => useToolIntegrationsMock(),
}));

vi.mock('../hooks/use-tools', () => ({
  useTools: (integrationId: string | null, params?: unknown) => useToolsMock(integrationId, params),
}));

// SideDialog uses radix-dialog + react-remove-scroll, which both pin their own
// react copy in the pnpm graph and break hook dispatch when rendered from a
// jsdom test. Stub it down to a plain container so we can exercise the
// dialog's own behaviour (chips, list, submit) without the portal stack.
vi.mock('@mastra/playground-ui', async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import('@mastra/playground-ui')>('@mastra/playground-ui');
  const Passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const SideDialog = Object.assign(
    ({ isOpen, children }: { isOpen: boolean; children?: ReactNode }) =>
      isOpen ? <div data-testid="side-dialog">{children}</div> : null,
    {
      Header: Passthrough,
      Heading: Passthrough,
    },
  );
  return {
    ...actual,
    SideDialog,
    TooltipProvider: Passthrough,
  };
});

const BASE_URL = 'http://localhost:4111';

const renderDialog = (
  overrides: {
    initialSelectedIds?: Set<string>;
    onSubmit?: (selection: AddToolsDialogSelection[]) => void;
    onClose?: () => void;
  } = {},
) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <AddToolsDialog
          open
          onClose={overrides.onClose ?? (() => {})}
          initialSelectedIds={overrides.initialSelectedIds}
          onSubmit={overrides.onSubmit ?? (() => {})}
        />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

describe('AddToolsDialog', () => {
  beforeEach(() => {
    useToolIntegrationsMock.mockReset();
    useToolsMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders an integration chip per registered provider', () => {
    useToolIntegrationsMock.mockReturnValue({
      data: {
        integrations: [
          { id: 'composio', displayName: 'Composio', capabilities: {} },
          { id: 'arcade', displayName: 'Arcade', capabilities: {} },
        ],
      },
      isLoading: false,
    });
    useToolsMock.mockReturnValue({ data: { data: [], pagination: { page: 1, hasMore: false } }, isLoading: false });

    renderDialog();

    expect(screen.getByTestId('add-tools-dialog-chip-composio')).toBeTruthy();
    expect(screen.getByTestId('add-tools-dialog-chip-arcade')).toBeTruthy();
  });

  it('marks the first integration active by default and switches on chip click', async () => {
    useToolIntegrationsMock.mockReturnValue({
      data: {
        integrations: [
          { id: 'composio', displayName: 'Composio', capabilities: {} },
          { id: 'arcade', displayName: 'Arcade', capabilities: {} },
        ],
      },
      isLoading: false,
    });
    useToolsMock.mockReturnValue({ data: { data: [], pagination: { page: 1, hasMore: false } }, isLoading: false });

    renderDialog();

    const composioChip = screen.getByTestId('add-tools-dialog-chip-composio');
    const arcadeChip = screen.getByTestId('add-tools-dialog-chip-arcade');

    await waitFor(() => expect(composioChip.getAttribute('aria-pressed')).toBe('true'));
    expect(arcadeChip.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      fireEvent.click(arcadeChip);
    });

    expect(arcadeChip.getAttribute('aria-pressed')).toBe('true');
    expect(composioChip.getAttribute('aria-pressed')).toBe('false');
  });

  it('renders the tools list returned for the active integration', async () => {
    useToolIntegrationsMock.mockReturnValue({
      data: { integrations: [{ id: 'composio', displayName: 'Composio', capabilities: {} }] },
      isLoading: false,
    });
    useToolsMock.mockReturnValue({
      data: {
        data: [
          { slug: 'GMAIL_FETCH_EMAILS', name: 'Fetch emails', toolService: 'gmail', description: 'Fetch inbox' },
          { slug: 'GMAIL_SEND_EMAIL', name: 'Send email', toolService: 'gmail' },
        ],
        pagination: { page: 1, hasMore: false },
      },
      isLoading: false,
    });

    renderDialog();

    await waitFor(() => expect(screen.getByTestId('add-tools-dialog-tool-GMAIL_FETCH_EMAILS')).toBeTruthy());
    expect(screen.getByTestId('add-tools-dialog-tool-GMAIL_SEND_EMAIL')).toBeTruthy();
    expect(screen.getByText('Fetch inbox')).toBeTruthy();
  });

  it('disables tools that are already on the agent', () => {
    useToolIntegrationsMock.mockReturnValue({
      data: { integrations: [{ id: 'composio', displayName: 'Composio', capabilities: {} }] },
      isLoading: false,
    });
    useToolsMock.mockReturnValue({
      data: {
        data: [{ slug: 'GMAIL_FETCH_EMAILS', name: 'Fetch emails', toolService: 'gmail' }],
        pagination: { page: 1, hasMore: false },
      },
      isLoading: false,
    });

    renderDialog({ initialSelectedIds: new Set(['composio:GMAIL_FETCH_EMAILS']) });

    const row = screen.getByTestId('add-tools-dialog-tool-GMAIL_FETCH_EMAILS');
    const checkbox = row.querySelector('[role="checkbox"]') as HTMLElement | null;
    expect(checkbox).not.toBeNull();
    // Radix checkbox surfaces disabled via `data-disabled` and the standard
    // `disabled` attribute; either signal is enough to confirm the contract.
    expect(checkbox?.hasAttribute('disabled') || checkbox?.hasAttribute('data-disabled')).toBe(true);
  });

  it('passes a structured selection to onSubmit on confirm', async () => {
    useToolIntegrationsMock.mockReturnValue({
      data: { integrations: [{ id: 'composio', displayName: 'Composio', capabilities: {} }] },
      isLoading: false,
    });
    useToolsMock.mockReturnValue({
      data: {
        data: [
          { slug: 'GMAIL_FETCH_EMAILS', name: 'Fetch emails', toolService: 'gmail' },
          { slug: 'GMAIL_SEND_EMAIL', name: 'Send email', toolService: 'gmail' },
        ],
        pagination: { page: 1, hasMore: false },
      },
      isLoading: false,
    });

    const onSubmit = vi.fn();
    const onClose = vi.fn();
    renderDialog({ onSubmit, onClose });

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-tools-dialog-tool-GMAIL_FETCH_EMAILS'));
    });

    const submitButton = screen.getByRole('button', { name: /add 1 tool/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(onSubmit).toHaveBeenCalledWith([
      {
        toolId: 'composio:GMAIL_FETCH_EMAILS',
        integrationId: 'composio',
        toolService: 'gmail',
        slug: 'GMAIL_FETCH_EMAILS',
      },
    ]);
    expect(onClose).toHaveBeenCalled();
  });

  it('disables the submit button until at least one tool is selected', () => {
    useToolIntegrationsMock.mockReturnValue({
      data: { integrations: [{ id: 'composio', displayName: 'Composio', capabilities: {} }] },
      isLoading: false,
    });
    useToolsMock.mockReturnValue({
      data: { data: [{ slug: 'X', name: 'X', toolService: 'gmail' }], pagination: { page: 1, hasMore: false } },
      isLoading: false,
    });

    renderDialog();

    const submit = screen.getByRole('button', { name: /add tools/i });
    expect(submit.hasAttribute('disabled')).toBe(true);
  });

  it('shows the empty state when the active integration returns zero tools', () => {
    useToolIntegrationsMock.mockReturnValue({
      data: { integrations: [{ id: 'composio', displayName: 'Composio', capabilities: {} }] },
      isLoading: false,
    });
    useToolsMock.mockReturnValue({ data: { data: [], pagination: { page: 1, hasMore: false } }, isLoading: false });

    renderDialog();

    expect(screen.getByText(/no tools found/i)).toBeTruthy();
  });
});
