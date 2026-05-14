// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentHealthResult } from '../hooks/use-agent-health';

import { HealthPill } from './health-pill';

// Stub useAuthorize so tests don't need to drive the popup + polling loop.
const authorizeMock = vi.fn();
vi.mock('../hooks/use-authorize', () => ({
  useAuthorize: () => ({
    mutateAsync: authorizeMock,
    isPending: false,
  }),
}));

const BASE_URL = 'http://localhost:4111';

const wrap = (ui: React.ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{ui}</TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const buildHealth = (
  state: AgentHealthResult['state'],
  overrides: Partial<AgentHealthResult> = {},
): AgentHealthResult => ({
  state,
  total: 0,
  connected: 0,
  integrations: [],
  isLoading: false,
  isError: false,
  invalidateIntegration: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('HealthPill', () => {
  beforeEach(() => {
    authorizeMock.mockReset();
  });
  afterEach(() => cleanup());

  it('renders nothing when state is empty', () => {
    const { container } = wrap(<HealthPill health={buildHealth('empty')} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders ok state with connected/total counts', () => {
    wrap(
      <HealthPill
        health={buildHealth('ok', {
          total: 2,
          connected: 2,
          integrations: [
            {
              integrationId: 'composio',
              state: 'ok',
              total: 2,
              connected: 2,
              byToolService: [
                {
                  toolService: 'gmail',
                  total: 2,
                  connected: 2,
                  disconnectedConnections: [],
                },
              ],
              isLoading: false,
              isError: false,
            },
          ],
        })}
      />,
    );
    const pill = screen.getByTestId('health-pill');
    expect(pill.getAttribute('data-state')).toBe('ok');
    expect(pill.textContent).toContain('2/2');
  });

  it('renders warn state when at least one connection is disconnected', () => {
    wrap(
      <HealthPill
        health={buildHealth('warn', {
          total: 2,
          connected: 1,
          integrations: [
            {
              integrationId: 'composio',
              state: 'warn',
              total: 2,
              connected: 1,
              byToolService: [
                {
                  toolService: 'gmail',
                  total: 2,
                  connected: 1,
                  disconnectedConnections: [{ connectionId: 'ca_2', label: 'Personal' }],
                },
              ],
              isLoading: false,
              isError: false,
            },
          ],
        })}
      />,
    );
    expect(screen.getByTestId('health-pill').getAttribute('data-state')).toBe('warn');
  });

  it('opens popover and lists per-service rows with disconnected labels', async () => {
    const invalidate = vi.fn().mockResolvedValue(undefined);
    wrap(
      <HealthPill
        health={buildHealth('warn', {
          total: 2,
          connected: 1,
          invalidateIntegration: invalidate,
          integrations: [
            {
              integrationId: 'composio',
              state: 'warn',
              total: 2,
              connected: 1,
              byToolService: [
                {
                  toolService: 'gmail',
                  total: 2,
                  connected: 1,
                  disconnectedConnections: [{ connectionId: 'ca_2', label: 'Personal' }],
                },
              ],
              isLoading: false,
              isError: false,
            },
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('health-pill'));

    await waitFor(() => {
      expect(screen.getByTestId('health-integration-composio')).toBeTruthy();
      expect(screen.getByTestId('health-service-composio-gmail')).toBeTruthy();
    });
    expect(screen.getByText('Personal')).toBeTruthy();
  });

  it('calls useAuthorize with existing connectionId on reauth, then invalidates the provider', async () => {
    authorizeMock.mockResolvedValue({ status: 'completed', connectionId: 'ca_new' });
    const invalidate = vi.fn().mockResolvedValue(undefined);
    wrap(
      <HealthPill
        health={buildHealth('warn', {
          total: 1,
          connected: 0,
          invalidateIntegration: invalidate,
          integrations: [
            {
              integrationId: 'composio',
              state: 'error',
              total: 1,
              connected: 0,
              byToolService: [
                {
                  toolService: 'gmail',
                  total: 1,
                  connected: 0,
                  disconnectedConnections: [{ connectionId: 'ca_broken', label: 'Work' }],
                },
              ],
              isLoading: false,
              isError: false,
            },
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('health-pill'));
    await waitFor(() => expect(screen.getByTestId('health-reauthorize-composio-gmail-ca_broken')).toBeTruthy());
    fireEvent.click(screen.getByTestId('health-reauthorize-composio-gmail-ca_broken'));

    await waitFor(() => expect(authorizeMock).toHaveBeenCalledTimes(1));
    expect(authorizeMock).toHaveBeenCalledWith({
      integrationId: 'composio',
      toolService: 'gmail',
      connectionId: 'ca_broken',
    });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith('composio'));
  });

  it('does not invalidate when reauth does not complete', async () => {
    authorizeMock.mockResolvedValue({ status: 'failed', connectionId: '' });
    const invalidate = vi.fn().mockResolvedValue(undefined);
    wrap(
      <HealthPill
        health={buildHealth('error', {
          total: 1,
          connected: 0,
          invalidateIntegration: invalidate,
          integrations: [
            {
              integrationId: 'composio',
              state: 'error',
              total: 1,
              connected: 0,
              byToolService: [
                {
                  toolService: 'gmail',
                  total: 1,
                  connected: 0,
                  disconnectedConnections: [{ connectionId: 'ca_broken', label: 'Work' }],
                },
              ],
              isLoading: false,
              isError: false,
            },
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('health-pill'));
    await waitFor(() => expect(screen.getByTestId('health-reauthorize-composio-gmail-ca_broken')).toBeTruthy());
    fireEvent.click(screen.getByTestId('health-reauthorize-composio-gmail-ca_broken'));

    await waitFor(() => expect(authorizeMock).toHaveBeenCalledTimes(1));
    expect(invalidate).not.toHaveBeenCalled();
  });
});
