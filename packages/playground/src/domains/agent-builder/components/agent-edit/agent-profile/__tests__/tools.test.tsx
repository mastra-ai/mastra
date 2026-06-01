// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentColorProvider } from '../../../../contexts/agent-color-context';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import type { AgentTool } from '../../../../types/agent-tool';
import { Tools } from '../tools';

const BASE_URL = 'http://localhost:4111';

/**
 * Default MSW handlers for the network the `Tools` component drives:
 * - `useToolProviders()` → providers list
 * - `useAllConnections()` fan-out → per-provider toolkits + per-pair connections
 *
 * Tests that need richer behavior override these with `server.use(...)`.
 */
const defaultToolNetworkHandlers = [
  http.get(`${BASE_URL}/api/tool-providers`, () => HttpResponse.json({ providers: [] })),
  // `useAllConnections({ scopeToSelf: true })` subscribes to `useCurrentUser`,
  // which fetches `/api/auth/me`. Without a handler the real network is hit
  // (bypass), causing flakes under parallel test load.
  http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'tester', permissions: [] })),
];

const sharedServer = setupServer(...defaultToolNetworkHandlers);

beforeAll(() => {
  sharedServer.listen({ onUnhandledRequest: 'bypass' });
  // Base UI's Checkbox synthesizes a PointerEvent on click, which jsdom does
  // not implement; alias it to MouseEvent so click handlers run.
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});
afterEach(() => {
  cleanup();
  sharedServer.resetHandlers(...defaultToolNetworkHandlers);
});
afterAll(() => sharedServer.close());

const FormHarness = ({ agentId = 'agent_test', children }: { agentId?: string; children: ReactNode }) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: {
      tools: {},
      agents: {},
      workflows: {},
    } as AgentBuilderEditFormValues,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <FormProvider {...methods}>
          <AgentColorProvider agentId={agentId}>{children}</AgentColorProvider>
        </FormProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const availableTools: AgentTool[] = [
  { id: 'checked-tool', name: 'checked-tool', isChecked: true, type: 'tool' },
  { id: 'unchecked-tool', name: 'unchecked-tool', isChecked: false, type: 'tool' },
];

describe('Tools', () => {
  afterEach(() => {
    cleanup();
  });

  it('paints the selected tool container and check cell with border-based HSL when an agentId is provided', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    const container = getByTestId('tool-card-tool-checked-tool') as HTMLButtonElement;
    const check = getByTestId('tool-card-check-tool-checked-tool') as HTMLSpanElement;

    // jsdom normalizes inline color values from hsl() to rgb() for color properties.
    expect(container.style.borderColor).toMatch(/^(rgb|hsl)\(/);
    expect(container.style.boxShadow).toBe('');
    expect(container.className).toContain('focus-visible:!border-[var(--agent-color-bg)]');
    expect(container.className).not.toContain('border-accent1');
    expect(container.className).not.toContain('ring-1 ring-accent1');
    expect(container.className).not.toContain('focus-visible:ring');

    expect(check.style.backgroundColor).toMatch(/^(rgb|hsl)\(/);
    expect(check.style.borderColor).toMatch(/^(rgb|hsl)\(/);
    expect(check.className).not.toContain('bg-accent1');
  });

  it('leaves unselected tile borders untouched while using agent color for focus when an agentId is provided', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    const container = getByTestId('tool-card-tool-unchecked-tool') as HTMLButtonElement;
    expect(container.style.getPropertyValue('--agent-color-bg')).toMatch(/^hsl\(/);
    expect(container.style.borderColor).toBe('');
    expect(container.className).toContain('border-border1');
    expect(container.className).toContain('focus-visible:!border-[var(--agent-color-bg)]');
    expect(container.className).not.toContain('focus-visible:ring');
  });

  it('renders the "Show only selected" filter checkbox unchecked by default with both tool cards visible', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    const checkbox = getByTestId('tools-only-selected-filter-checkbox');
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
    expect(getByTestId('tool-card-tool-checked-tool')).toBeTruthy();
    expect(getByTestId('tool-card-tool-unchecked-tool')).toBeTruthy();
  });

  it('checking the filter hides unselected tools and keeps selected ones', () => {
    const { getByTestId, queryByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    fireEvent.click(getByTestId('tools-only-selected-filter-checkbox'));

    expect(queryByTestId('tool-card-tool-checked-tool')).toBeTruthy();
    expect(queryByTestId('tool-card-tool-unchecked-tool')).toBeNull();
  });

  it('unchecking the filter restores hidden tools', () => {
    const { getByTestId, queryByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    const checkbox = getByTestId('tools-only-selected-filter-checkbox');
    fireEvent.click(checkbox);
    expect(queryByTestId('tool-card-tool-unchecked-tool')).toBeNull();

    fireEvent.click(checkbox);
    expect(queryByTestId('tool-card-tool-checked-tool')).toBeTruthy();
    expect(queryByTestId('tool-card-tool-unchecked-tool')).toBeTruthy();
  });

  it('shows the empty-state copy when the filter is on and nothing is selected', () => {
    const noneSelected = [
      { id: 'a', name: 'a', isChecked: false, type: 'tool' as const },
      { id: 'b', name: 'b', isChecked: false, type: 'tool' as const },
    ];
    const { getByTestId, getByText } = render(
      <FormHarness>
        <Tools availableAgentTools={noneSelected} />
      </FormHarness>,
    );

    fireEvent.click(getByTestId('tools-only-selected-filter-checkbox'));

    expect(getByText('No tools selected yet')).toBeTruthy();
  });

  it('combines the filter with search to show the dedicated empty-state copy', async () => {
    const { getByTestId, findByText } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    const searchInput = getByTestId('tools-card-picker-search').querySelector('input');
    expect(searchInput).toBeTruthy();
    fireEvent.change(searchInput!, { target: { value: 'unchecked' } });

    fireEvent.click(getByTestId('tools-only-selected-filter-checkbox'));

    await findByText('No selected tools match "unchecked"');
  });

  it('uses the small-size classes matching the provider-filter checkbox in models.tsx', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    const checkbox = getByTestId('tools-only-selected-filter-checkbox');
    expect(checkbox.className).toContain('h-3');
    expect(checkbox.className).toContain('w-3');
    expect(checkbox.className).toContain('[&_svg]:h-2.5');
  });

  it('paints the filter checkbox with the agent color only when the filter is checked', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    const checkbox = getByTestId('tools-only-selected-filter-checkbox') as HTMLButtonElement;
    expect(checkbox.getAttribute('style')).toBeNull();

    fireEvent.click(checkbox);

    expect(checkbox.style.backgroundColor).toMatch(/^(rgb|hsl)\(/);
    expect(checkbox.style.borderColor).toMatch(/^(rgb|hsl)\(/);
  });

  it('renders the search input and the filter checkbox in the same flex row', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={availableTools} />
      </FormHarness>,
    );

    const searchWrapper = getByTestId('tools-card-picker-search');
    const filterLabel = getByTestId('tools-only-selected-filter');

    expect(searchWrapper.parentElement).toBe(filterLabel.parentElement);
    expect(filterLabel.parentElement?.className).toContain('flex');
    expect(filterLabel.parentElement?.className).toContain('justify-between');
  });
});

describe('Tools — toolkit filter pane', () => {
  const mixedTools: AgentTool[] = [
    { id: 'native-tool', name: 'native-tool', isChecked: false, type: 'tool' },
    {
      id: 'composio:GMAIL_FETCH',
      name: 'GMAIL_FETCH',
      isChecked: false,
      type: 'integration',
      providerId: 'composio',
      toolkit: 'gmail',
      hasConnection: true,
    },
    {
      id: 'composio:SLACK_POST',
      name: 'SLACK_POST',
      isChecked: false,
      type: 'integration',
      providerId: 'composio',
      toolkit: 'slack',
      hasConnection: true,
    },
  ];

  it('lists one entry per integration toolkit plus a Built-in entry, all checked by default', () => {
    const { getByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={mixedTools} />
      </FormHarness>,
    );

    expect(getByTestId('tools-toolkit-filter-item-gmail')).toBeTruthy();
    expect(getByTestId('tools-toolkit-filter-item-slack')).toBeTruthy();
    expect(getByTestId('tools-toolkit-filter-item-__built-in__')).toBeTruthy();

    expect(getByTestId('tools-toolkit-filter-checkbox-gmail').getAttribute('aria-checked')).toBe('true');
    expect(getByTestId('tools-toolkit-filter-checkbox-slack').getAttribute('aria-checked')).toBe('true');
    expect(getByTestId('tools-toolkit-filter-checkbox-__built-in__').getAttribute('aria-checked')).toBe('true');
  });

  it("unchecking an integration toolkit hides only that toolkit's cards", () => {
    const { getByTestId, queryByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={mixedTools} />
      </FormHarness>,
    );

    fireEvent.click(getByTestId('tools-toolkit-filter-checkbox-slack'));

    expect(queryByTestId('tool-card-integration-composio:SLACK_POST')).toBeNull();
    expect(queryByTestId('tool-card-integration-composio:GMAIL_FETCH')).toBeTruthy();
    expect(queryByTestId('tool-card-tool-native-tool')).toBeTruthy();
  });

  it('unchecking Built-in hides native tools but keeps integration cards', () => {
    const { getByTestId, queryByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={mixedTools} />
      </FormHarness>,
    );

    fireEvent.click(getByTestId('tools-toolkit-filter-checkbox-__built-in__'));

    expect(queryByTestId('tool-card-tool-native-tool')).toBeNull();
    expect(queryByTestId('tool-card-integration-composio:GMAIL_FETCH')).toBeTruthy();
    expect(queryByTestId('tool-card-integration-composio:SLACK_POST')).toBeTruthy();
  });

  it('Clear all hides every tool and shows the toolkit empty-state copy', () => {
    const { getByTestId, getByText, queryByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={mixedTools} />
      </FormHarness>,
    );

    fireEvent.click(getByTestId('tools-toolkit-filter-clear-all'));

    expect(queryByTestId('tool-card-tool-native-tool')).toBeNull();
    expect(queryByTestId('tool-card-integration-composio:GMAIL_FETCH')).toBeNull();
    expect(getByText('Select at least one toolkit to see tools')).toBeTruthy();
  });

  it('Select all restores every tool after clearing', () => {
    const { getByTestId, queryByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={mixedTools} />
      </FormHarness>,
    );

    fireEvent.click(getByTestId('tools-toolkit-filter-clear-all'));
    expect(queryByTestId('tool-card-tool-native-tool')).toBeNull();

    fireEvent.click(getByTestId('tools-toolkit-filter-select-all'));
    expect(queryByTestId('tool-card-tool-native-tool')).toBeTruthy();
    expect(queryByTestId('tool-card-integration-composio:GMAIL_FETCH')).toBeTruthy();
    expect(queryByTestId('tool-card-integration-composio:SLACK_POST')).toBeTruthy();
  });

  it('left-pane search filters the toolkit checklist without affecting the tool grid', async () => {
    const { getByTestId, queryByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={mixedTools} />
      </FormHarness>,
    );

    const filterSearch = getByTestId('tools-toolkit-filter-search').querySelector('input');
    expect(filterSearch).toBeTruthy();
    fireEvent.change(filterSearch!, { target: { value: 'slack' } });

    await waitFor(() => expect(queryByTestId('tools-toolkit-filter-item-gmail')).toBeNull());
    expect(queryByTestId('tools-toolkit-filter-item-slack')).toBeTruthy();

    // Tool grid is unaffected by the left-pane search.
    expect(queryByTestId('tool-card-integration-composio:GMAIL_FETCH')).toBeTruthy();
    expect(queryByTestId('tool-card-tool-native-tool')).toBeTruthy();
  });
});

describe('Tools — integration rows without a connection', () => {
  beforeEach(() => {
    sharedServer.use(
      http.post(`${BASE_URL}/api/tool-providers/composio/authorize`, () =>
        HttpResponse.json({ url: 'https://oauth.example/authorize', authId: 'auth_abc' }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/composio/auth-status/auth_abc`, () =>
        HttpResponse.json({ status: 'completed' }),
      ),
    );
  });

  const ConnectHarness = ({
    children,
    onState,
  }: {
    children: ReactNode;
    onState?: (state: AgentBuilderEditFormValues) => void;
  }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { tools: {}, agents: {}, workflows: {}, toolProviders: {} } as AgentBuilderEditFormValues,
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return (
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <FormProvider {...methods}>
            <AgentColorProvider agentId="agent_test">
              {children}
              {onState && (
                <button type="button" data-testid="spy-form-state" onClick={() => onState(methods.getValues())}>
                  spy
                </button>
              )}
            </AgentColorProvider>
          </FormProvider>
        </QueryClientProvider>
      </MastraReactProvider>
    );
  };

  const unconnectedIntegrationTool: AgentTool = {
    id: 'composio:GMAIL_FETCH_EMAILS',
    name: 'GMAIL_FETCH_EMAILS',
    description: 'Fetch emails',
    isChecked: false,
    type: 'integration',
    providerId: 'composio',
    toolkit: 'gmail',
    hasConnection: false,
  };

  it('renders a Connect button alongside the selectable card when an integration row has no connection', () => {
    const { getByTestId, getByText } = render(
      <ConnectHarness>
        <Tools availableAgentTools={[unconnectedIntegrationTool]} />
      </ConnectHarness>,
    );

    // Connect button is present.
    expect(getByTestId('tool-card-connect-integration-composio:GMAIL_FETCH_EMAILS')).toBeTruthy();
    // Card stays selectable — checkbox span is still rendered.
    expect(getByTestId('tool-card-check-integration-composio:GMAIL_FETCH_EMAILS')).toBeTruthy();
    // Inline hint is shown.
    expect(getByText('Needs connection')).toBeTruthy();
  });

  it('clicking Connect kicks off the OAuth popup and authorize call', async () => {
    const openPopup = vi.fn().mockReturnValue({ close: vi.fn() });
    // Stub window.open so useAuthorize's default popup opener resolves
    // synchronously without a real browser.
    const originalOpen = window.open;
    window.open = openPopup as unknown as typeof window.open;

    try {
      const { getByTestId } = render(
        <ConnectHarness>
          <Tools availableAgentTools={[unconnectedIntegrationTool]} />
        </ConnectHarness>,
      );

      fireEvent.click(getByTestId('tool-card-connect-integration-composio:GMAIL_FETCH_EMAILS'));

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

  it('auto-pins the new connection on a checked integration card after successful OAuth', async () => {
    const openPopup = vi.fn().mockReturnValue({ close: vi.fn() });
    const originalOpen = window.open;
    window.open = openPopup as unknown as typeof window.open;

    const spy = vi.fn();
    try {
      const checkedAndUnconnected: AgentTool = { ...unconnectedIntegrationTool, isChecked: true };
      const { getByTestId } = render(
        <ConnectHarness onState={spy}>
          <Tools availableAgentTools={[checkedAndUnconnected]} />
        </ConnectHarness>,
      );

      fireEvent.click(getByTestId('tool-card-connect-integration-composio:GMAIL_FETCH_EMAILS'));

      // Wait for the OAuth poll loop (2s default) to resolve. The auth-status
      // handler immediately returns `completed`, so after one poll the
      // mutation onSuccess fires and the parent writes the pin.
      await waitFor(
        () => {
          fireEvent.click(getByTestId('spy-form-state'));
          const state = spy.mock.calls[spy.mock.calls.length - 1]?.[0] as AgentBuilderEditFormValues | undefined;
          expect(state?.toolProviders?.composio?.connections?.gmail).toEqual([
            { kind: 'author', toolkit: 'gmail', connectionId: 'auth_abc', scope: 'per-author' },
          ]);
        },
        { timeout: 5000 },
      );
    } finally {
      window.open = originalOpen;
    }
  }, 10000);

  it('auto-checks the tool AND auto-pins the new connection when Connect is clicked on an unchecked card', async () => {
    const openPopup = vi.fn().mockReturnValue({ close: vi.fn() });
    const originalOpen = window.open;
    window.open = openPopup as unknown as typeof window.open;

    const spy = vi.fn();
    try {
      const { getByTestId } = render(
        <ConnectHarness onState={spy}>
          <Tools availableAgentTools={[unconnectedIntegrationTool]} />
        </ConnectHarness>,
      );

      fireEvent.click(getByTestId('tool-card-connect-integration-composio:GMAIL_FETCH_EMAILS'));

      // Clicking Connect on an unchecked card means "I want this tool with
      // this new connection" — the tool gets added to `tools` and the
      // freshly-authorized connection gets pinned in one step.
      await waitFor(
        () => {
          fireEvent.click(getByTestId('spy-form-state'));
          const state = spy.mock.calls[spy.mock.calls.length - 1]?.[0] as AgentBuilderEditFormValues | undefined;
          expect(state?.toolProviders?.composio?.tools?.GMAIL_FETCH_EMAILS).toEqual({
            toolkit: 'gmail',
            description: 'Fetch emails',
          });
          expect(state?.toolProviders?.composio?.connections?.gmail).toEqual([
            { kind: 'author', toolkit: 'gmail', connectionId: 'auth_abc', scope: 'per-author' },
          ]);
        },
        { timeout: 5000 },
      );
    } finally {
      window.open = originalOpen;
    }
  }, 10000);
});

describe('Tools — checked integration rows render the connection picker', () => {
  beforeEach(() => {
    // Stamp the providers list + toolkit list shared by all picker scenarios.
    sharedServer.use(
      http.get(`${BASE_URL}/api/tool-providers`, () =>
        HttpResponse.json({
          providers: [
            {
              id: 'composio',
              name: 'Composio',
              capabilities: { multipleConnectionsPerToolkit: true },
            },
          ],
        }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/composio/toolkits`, () =>
        HttpResponse.json({ data: [{ slug: 'gmail', name: 'Gmail' }] }),
      ),
    );
  });

  const PickerHarness = ({
    children,
    onState,
  }: {
    children: ReactNode;
    onState?: (state: AgentBuilderEditFormValues) => void;
  }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: { tools: {}, agents: {}, workflows: {}, toolProviders: {} } as AgentBuilderEditFormValues,
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Expose form state to assertions via a spy button.
    return (
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <FormProvider {...methods}>
            <AgentColorProvider agentId="agent_test">
              {children}
              {onState && (
                <button type="button" data-testid="spy-form-state" onClick={() => onState(methods.getValues())}>
                  spy
                </button>
              )}
            </AgentColorProvider>
          </FormProvider>
        </QueryClientProvider>
      </MastraReactProvider>
    );
  };

  const checkedIntegrationTool: AgentTool = {
    id: 'composio:GMAIL_FETCH_EMAILS',
    name: 'GMAIL_FETCH_EMAILS',
    description: 'Fetch emails',
    isChecked: true,
    type: 'integration',
    providerId: 'composio',
    toolkit: 'gmail',
    hasConnection: true,
  };

  it('renders the IntegrationConnectionPicker beneath a checked integration card', async () => {
    sharedServer.use(
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () => HttpResponse.json({ items: [] })),
    );

    const { findByTestId } = render(
      <PickerHarness>
        <Tools availableAgentTools={[checkedIntegrationTool]} />
      </PickerHarness>,
    );

    expect(await findByTestId('integration-connection-picker-composio-gmail')).toBeTruthy();
  });

  it('does NOT render the picker for an unchecked integration row', async () => {
    sharedServer.use(
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () => HttpResponse.json({ items: [] })),
    );

    const unchecked = { ...checkedIntegrationTool, isChecked: false };
    const { queryByTestId, findByTestId } = render(
      <PickerHarness>
        <Tools availableAgentTools={[unchecked]} />
      </PickerHarness>,
    );

    // Card present, picker absent.
    await findByTestId('tool-card-check-integration-composio:GMAIL_FETCH_EMAILS');
    expect(queryByTestId('integration-connection-picker-composio-gmail')).toBeNull();
  });

  it('toggling a tool ON with exactly one existing connection does NOT auto-pin (picker is source of truth)', async () => {
    sharedServer.use(
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () =>
        HttpResponse.json({ items: [{ connectionId: 'conn_only', status: 'active', label: 'only' }] }),
      ),
    );

    const spy = vi.fn();
    const unchecked = { ...checkedIntegrationTool, isChecked: false };
    const { getByTestId } = render(
      <PickerHarness onState={spy}>
        <Tools availableAgentTools={[unchecked]} />
      </PickerHarness>,
    );

    // Let the connections fan-out settle so we know the picker has data
    // available; the toggle should still leave the pinned list empty.
    await waitFor(() => {
      expect(getByTestId('tool-card-integration-composio:GMAIL_FETCH_EMAILS')).toBeTruthy();
    });
    await new Promise(r => setTimeout(r, 50));

    fireEvent.click(getByTestId('tool-card-integration-composio:GMAIL_FETCH_EMAILS'));

    fireEvent.click(getByTestId('spy-form-state'));
    const state = spy.mock.calls[0][0] as AgentBuilderEditFormValues;
    const pinned = (
      state as unknown as {
        toolProviders: { composio?: { connections?: { gmail?: Array<unknown> } } };
      }
    ).toolProviders.composio?.connections?.gmail;
    expect(pinned ?? []).toEqual([]);
  });

  it('toggling a tool ON with two existing connections does NOT auto-pin', async () => {
    sharedServer.use(
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () =>
        HttpResponse.json({
          items: [
            { connectionId: 'conn_work', status: 'active', label: 'work' },
            { connectionId: 'conn_personal', status: 'active', label: 'personal' },
          ],
        }),
      ),
    );

    const spy = vi.fn();
    const unchecked = { ...checkedIntegrationTool, isChecked: false };
    const { getByTestId } = render(
      <PickerHarness onState={spy}>
        <Tools availableAgentTools={[unchecked]} />
      </PickerHarness>,
    );

    await new Promise(r => setTimeout(r, 50));
    fireEvent.click(getByTestId('tool-card-integration-composio:GMAIL_FETCH_EMAILS'));

    fireEvent.click(getByTestId('spy-form-state'));
    const state = spy.mock.calls[0][0] as AgentBuilderEditFormValues;
    const pinned = (
      state as unknown as {
        toolProviders: { composio?: { connections?: { gmail?: Array<unknown> } } };
      }
    ).toolProviders.composio?.connections?.gmail;
    expect(pinned ?? []).toEqual([]);
  });
});
