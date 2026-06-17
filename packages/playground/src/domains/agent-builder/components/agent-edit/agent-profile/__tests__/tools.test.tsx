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
import { GMAIL_ICON_URL, composioProvider, composioToolkits } from './fixtures/toolkits';

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

    await findByText('No selected tools match unchecked');
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

  // Providers are fetched first, then each provider's toolkits. The default
  // handlers return no providers, so this block stamps a `composio` provider
  // whose toolkits include `gmail` and `slack`.
  beforeEach(() => {
    sharedServer.use(
      http.get(`${BASE_URL}/api/tool-providers`, () => HttpResponse.json(composioProvider)),
      http.get(`${BASE_URL}/api/tool-providers/composio/toolkits`, () => HttpResponse.json(composioToolkits)),
      // Each provider toolkit row mounts a connection control that lists its
      // connections; default to none so the rows show the "Connect" button.
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () => HttpResponse.json({ items: [] })),
    );
  });

  it('groups toolkits under their provider plus a Built-in group, all checked by default', async () => {
    const { findByTestId, getByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={mixedTools} />
      </FormHarness>,
    );

    // Built-in renders immediately; provider toolkits render after the
    // providers + toolkits queries resolve.
    expect(getByTestId('tools-toolkit-filter-item-__built-in__')).toBeTruthy();
    await findByTestId('tools-toolkit-filter-item-gmail');
    expect(getByTestId('tools-toolkit-filter-item-slack')).toBeTruthy();

    // The provider section header groups its toolkits.
    expect(getByTestId('tools-provider-section-composio').textContent).toBe('Composio');

    expect(getByTestId('tools-toolkit-filter-checkbox-gmail').getAttribute('aria-checked')).toBe('true');
    expect(getByTestId('tools-toolkit-filter-checkbox-slack').getAttribute('aria-checked')).toBe('true');
    expect(getByTestId('tools-toolkit-filter-checkbox-__built-in__').getAttribute('aria-checked')).toBe('true');
  });

  it('renders the backend toolkit icon for toolkits that have one, and none for Built-in or icon-less toolkits', async () => {
    const { findByTestId, getByTestId, queryByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={mixedTools} />
      </FormHarness>,
    );

    await findByTestId('tools-toolkit-filter-item-gmail');

    // Gmail has an icon in the fixture → it renders an <img> with that src.
    const gmailIcon = getByTestId('tools-toolkit-filter-icon-gmail') as HTMLImageElement;
    expect(gmailIcon.tagName).toBe('IMG');
    expect(gmailIcon.getAttribute('src')).toBe(GMAIL_ICON_URL);

    // Slack has no icon, and Built-in never has one.
    expect(queryByTestId('tools-toolkit-filter-icon-slack')).toBeNull();
    expect(queryByTestId('tools-toolkit-filter-icon-__built-in__')).toBeNull();
  });

  it('shows a skeleton while providers load, then reveals the provider toolkits', async () => {
    let resolveProviders: () => void = () => {};
    const providersGate = new Promise<void>(resolve => {
      resolveProviders = resolve;
    });
    sharedServer.use(
      http.get(`${BASE_URL}/api/tool-providers`, async () => {
        await providersGate;
        return HttpResponse.json(composioProvider);
      }),
    );

    const { findByTestId, queryByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={mixedTools} />
      </FormHarness>,
    );

    // While providers are pending the provider toolkits are not yet rendered.
    expect(queryByTestId('tools-toolkit-filter-item-gmail')).toBeNull();

    resolveProviders();
    await findByTestId('tools-toolkit-filter-item-gmail');
  });

  it("unchecking an integration toolkit hides only that toolkit's cards", async () => {
    const { findByTestId, getByTestId, queryByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={mixedTools} />
      </FormHarness>,
    );

    fireEvent.click(await findByTestId('tools-toolkit-filter-checkbox-slack'));

    expect(queryByTestId('tool-card-integration-composio:SLACK_POST')).toBeNull();
    expect(getByTestId('tool-card-integration-composio:GMAIL_FETCH')).toBeTruthy();
    expect(getByTestId('tool-card-tool-native-tool')).toBeTruthy();
  });

  it('unchecking Built-in hides native tools but keeps integration cards', async () => {
    const { findByTestId, getByTestId, queryByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={mixedTools} />
      </FormHarness>,
    );

    // Wait for provider toolkits so the integration cards are mounted.
    await findByTestId('tools-toolkit-filter-item-gmail');
    fireEvent.click(getByTestId('tools-toolkit-filter-checkbox-__built-in__'));

    expect(queryByTestId('tool-card-tool-native-tool')).toBeNull();
    expect(getByTestId('tool-card-integration-composio:GMAIL_FETCH')).toBeTruthy();
    expect(getByTestId('tool-card-integration-composio:SLACK_POST')).toBeTruthy();
  });

  it('Clear all hides every tool and shows the toolkit empty-state copy', async () => {
    const { findByTestId, getByTestId, getByText, queryByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={mixedTools} />
      </FormHarness>,
    );

    await findByTestId('tools-toolkit-filter-item-gmail');
    fireEvent.click(getByTestId('tools-toolkit-filter-clear-all'));

    expect(queryByTestId('tool-card-tool-native-tool')).toBeNull();
    expect(queryByTestId('tool-card-integration-composio:GMAIL_FETCH')).toBeNull();
    expect(getByText('Select at least one toolkit to see tools')).toBeTruthy();
  });

  it('Select all restores every tool after clearing', async () => {
    const { findByTestId, getByTestId, queryByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={mixedTools} />
      </FormHarness>,
    );

    await findByTestId('tools-toolkit-filter-item-gmail');
    fireEvent.click(getByTestId('tools-toolkit-filter-clear-all'));
    expect(queryByTestId('tool-card-tool-native-tool')).toBeNull();

    fireEvent.click(getByTestId('tools-toolkit-filter-select-all'));
    expect(getByTestId('tool-card-tool-native-tool')).toBeTruthy();
    expect(getByTestId('tool-card-integration-composio:GMAIL_FETCH')).toBeTruthy();
    expect(getByTestId('tool-card-integration-composio:SLACK_POST')).toBeTruthy();
  });

  it('left-pane search filters the toolkit checklist without affecting the tool grid', async () => {
    const { findByTestId, getByTestId, queryByTestId } = render(
      <FormHarness>
        <Tools availableAgentTools={mixedTools} />
      </FormHarness>,
    );

    await findByTestId('tools-toolkit-filter-item-gmail');
    const filterSearch = getByTestId('tools-toolkit-filter-search').querySelector('input');
    expect(filterSearch).toBeTruthy();
    fireEvent.change(filterSearch!, { target: { value: 'slack' } });

    await waitFor(() => expect(queryByTestId('tools-toolkit-filter-item-gmail')).toBeNull());
    expect(getByTestId('tools-toolkit-filter-item-slack')).toBeTruthy();

    // Tool grid is unaffected by the left-pane search.
    expect(getByTestId('tool-card-integration-composio:GMAIL_FETCH')).toBeTruthy();
    expect(getByTestId('tool-card-tool-native-tool')).toBeTruthy();
  });
});

describe('Tools — integration rows without a connection', () => {
  beforeEach(() => {
    sharedServer.use(
      // The toolkit row mounts a connection control, so the provider +
      // toolkit lists must resolve for it to render.
      http.get(`${BASE_URL}/api/tool-providers`, () => HttpResponse.json(composioProvider)),
      http.get(`${BASE_URL}/api/tool-providers/composio/toolkits`, () => HttpResponse.json(composioToolkits)),
      // No existing connections → the toolkit row shows "Connect".
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () => HttpResponse.json({ items: [] })),
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
    defaultToolProviders,
  }: {
    children: ReactNode;
    onState?: (state: AgentBuilderEditFormValues) => void;
    defaultToolProviders?: AgentBuilderEditFormValues['toolProviders'];
  }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: {
        tools: {},
        agents: {},
        workflows: {},
        toolProviders: defaultToolProviders ?? {},
      } as AgentBuilderEditFormValues,
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

  it('shows a muted "Requires connection" hint on the card and a Connect button on the toolkit row', async () => {
    const { findByTestId, getByTestId, getByText, queryByTestId } = render(
      <ConnectHarness>
        <Tools availableAgentTools={[unconnectedIntegrationTool]} />
      </ConnectHarness>,
    );

    // Card stays selectable — checkbox span is still rendered — and shows the hint.
    expect(getByTestId('tool-card-check-integration-composio:GMAIL_FETCH_EMAILS')).toBeTruthy();
    expect(getByText('Requires connection')).toBeTruthy();

    // The connection control now lives on the toolkit row, not the card.
    expect(queryByTestId('tool-card-connect-integration-composio:GMAIL_FETCH_EMAILS')).toBeNull();
    const connectBtn = await findByTestId('toolkit-connect-composio-gmail');
    expect(connectBtn.textContent).toContain('Connect');
  });

  it('clicking the toolkit-row Connect button authorizes and opens the provider consent popup', async () => {
    const openPopup = vi.fn().mockReturnValue({ close: vi.fn() });
    // Stub window.open so useAuthorize's default opener resolves synchronously.
    const originalOpen = window.open;
    window.open = openPopup as unknown as typeof window.open;

    try {
      const { findByTestId } = render(
        <ConnectHarness>
          <Tools availableAgentTools={[unconnectedIntegrationTool]} />
        </ConnectHarness>,
      );

      fireEvent.click(await findByTestId('toolkit-connect-composio-gmail'));

      await waitFor(() => {
        expect(openPopup).toHaveBeenCalledWith(
          'https://oauth.example/authorize',
          '_blank',
          expect.stringContaining('popup'),
        );
      });
    } finally {
      window.open = originalOpen;
    }
  });

  it('pins the new connection into the toolkit form field after successful OAuth when a tool is selected', async () => {
    const openPopup = vi.fn().mockReturnValue({ close: vi.fn() });
    const originalOpen = window.open;
    window.open = openPopup as unknown as typeof window.open;

    // After OAuth completes the connections list must report the new active
    // account so the toolkit control pins it into the form.
    let authorized = false;
    sharedServer.use(
      http.post(`${BASE_URL}/api/tool-providers/composio/authorize`, () => {
        authorized = true;
        return HttpResponse.json({ url: 'https://oauth.example/authorize', authId: 'auth_abc' });
      }),
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () =>
        HttpResponse.json({
          items: authorized ? [{ connectionId: 'auth_abc', status: 'active', label: 'work' }] : [],
        }),
      ),
    );

    const spy = vi.fn();
    try {
      // A tool in the gmail toolkit is already selected in the form.
      const checkedAndUnconnected: AgentTool = { ...unconnectedIntegrationTool, isChecked: true };
      const { findByTestId, getByTestId } = render(
        <ConnectHarness
          onState={spy}
          defaultToolProviders={
            {
              composio: { tools: { GMAIL_FETCH_EMAILS: { toolkit: 'gmail' } }, connections: {} },
            } as AgentBuilderEditFormValues['toolProviders']
          }
        >
          <Tools availableAgentTools={[checkedAndUnconnected]} />
        </ConnectHarness>,
      );

      fireEvent.click(await findByTestId('toolkit-connect-composio-gmail'));

      await waitFor(
        () => {
          fireEvent.click(getByTestId('spy-form-state'));
          const state = spy.mock.calls[spy.mock.calls.length - 1]?.[0] as AgentBuilderEditFormValues | undefined;
          expect(state?.toolProviders?.composio?.connections?.gmail).toEqual([
            { kind: 'author', toolkit: 'gmail', connectionId: 'auth_abc', label: 'work', scope: 'per-author' },
          ]);
        },
        { timeout: 5000 },
      );
    } finally {
      window.open = originalOpen;
    }
  }, 10000);
});

describe('Tools — toolkit row connection management', () => {
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
    defaultToolProviders,
  }: {
    children: ReactNode;
    onState?: (state: AgentBuilderEditFormValues) => void;
    defaultToolProviders?: AgentBuilderEditFormValues['toolProviders'];
  }) => {
    const methods = useForm<AgentBuilderEditFormValues>({
      defaultValues: {
        tools: {},
        agents: {},
        workflows: {},
        toolProviders: defaultToolProviders ?? {},
      } as AgentBuilderEditFormValues,
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

  // Form state for a gmail tool already selected — the toolkit control only
  // pins connections while a tool in the toolkit is selected in the form.
  const gmailToolSelected: AgentBuilderEditFormValues['toolProviders'] = {
    composio: { tools: { GMAIL_FETCH_EMAILS: { toolkit: 'gmail' } }, connections: {} },
  } as AgentBuilderEditFormValues['toolProviders'];

  it('shows a skeleton while the connections query is loading, then resolves the control', async () => {
    let releaseConnections: () => void = () => {};
    const connectionsGate = new Promise<void>(resolve => {
      releaseConnections = resolve;
    });
    sharedServer.use(
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, async () => {
        await connectionsGate;
        return HttpResponse.json({ items: [{ connectionId: 'conn_only', status: 'active', label: 'only' }] });
      }),
    );

    const { findByTestId, queryByTestId } = render(
      <PickerHarness>
        <Tools availableAgentTools={[checkedIntegrationTool]} />
      </PickerHarness>,
    );

    // While loading, neither Connect nor the cog flashes — a skeleton stands in.
    await findByTestId('toolkit-connection-loading-composio-gmail');
    expect(queryByTestId('toolkit-connect-composio-gmail')).toBeNull();
    expect(queryByTestId('toolkit-manage-composio-gmail')).toBeNull();

    releaseConnections();

    // Once resolved, the skeleton is replaced by the manage cog.
    await findByTestId('toolkit-manage-composio-gmail');
    expect(queryByTestId('toolkit-connection-loading-composio-gmail')).toBeNull();
  });

  it('renders connection-name badges under a connected tool card', async () => {
    const connectedWithLabels: AgentTool = {
      ...checkedIntegrationTool,
      connectionLabels: ['work', 'personal'],
    };

    const { findByTestId, getByText } = render(
      <PickerHarness>
        <Tools availableAgentTools={[connectedWithLabels]} />
      </PickerHarness>,
    );

    const badges = await findByTestId('tool-card-connections-integration-composio:GMAIL_FETCH_EMAILS');
    expect(badges.className).toContain('flex-wrap');
    expect(badges.className).toContain('gap-2');
    expect(getByText('work')).toBeTruthy();
    expect(getByText('personal')).toBeTruthy();
  });

  it('does not render the connection-badges container when a connected tool has no labels', async () => {
    const { findByTestId, queryByTestId } = render(
      <PickerHarness>
        <Tools availableAgentTools={[checkedIntegrationTool]} />
      </PickerHarness>,
    );

    // Card still renders (selectable), but no badge container without labels.
    await findByTestId('tool-card-check-integration-composio:GMAIL_FETCH_EMAILS');
    expect(queryByTestId('tool-card-connections-integration-composio:GMAIL_FETCH_EMAILS')).toBeNull();
  });

  it('shows a manage cog (not a Connect button) on the toolkit row when a connection exists', async () => {
    sharedServer.use(
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () =>
        HttpResponse.json({
          items: [
            { connectionId: 'conn_work', status: 'active', label: 'work' },
            { connectionId: 'conn_pending', status: 'pending', label: 'pending' },
          ],
        }),
      ),
    );

    const { findByTestId, queryByTestId } = render(
      <PickerHarness>
        <Tools availableAgentTools={[checkedIntegrationTool]} />
      </PickerHarness>,
    );

    // An active connection exists → the row shows the manage cog, not Connect.
    await findByTestId('toolkit-manage-composio-gmail');
    expect(queryByTestId('toolkit-connect-composio-gmail')).toBeNull();

    // The card no longer renders connection badges.
    expect(queryByTestId('connection-badge-composio-gmail-conn_work')).toBeNull();
  });

  it('opening the manage cog renders the rename + disconnect dialog and disconnect is gated by an AlertDialog', async () => {
    sharedServer.use(
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () =>
        HttpResponse.json({ items: [{ connectionId: 'conn_only', status: 'active', label: 'only' }] }),
      ),
      http.delete(`${BASE_URL}/api/tool-providers/composio/connections/conn_only`, () =>
        HttpResponse.json({ success: true }),
      ),
    );

    const { findByTestId, getByTestId, queryByTestId } = render(
      <PickerHarness>
        <Tools availableAgentTools={[checkedIntegrationTool]} />
      </PickerHarness>,
    );

    fireEvent.click(await findByTestId('toolkit-manage-composio-gmail'));

    // The dialog always opens on the connection list; drill into the account.
    await findByTestId('toolkit-manage-composio-gmail-list');
    fireEvent.click(getByTestId('toolkit-manage-composio-gmail-list-item-conn_only'));

    // Rename input + Disconnect button are present.
    await findByTestId('toolkit-manage-composio-gmail-input');
    fireEvent.click(getByTestId('toolkit-manage-composio-gmail-disconnect'));

    // Disconnect first opens the confirmation AlertDialog.
    await findByTestId('toolkit-manage-composio-gmail-disconnect-dialog');
    fireEvent.click(getByTestId('toolkit-manage-composio-gmail-disconnect-confirm'));

    // After confirming the last account, the dialog closes.
    await waitFor(() => expect(queryByTestId('toolkit-manage-composio-gmail-disconnect-dialog')).toBeNull());
  });

  it('the manage cog always opens on the connection list, even for a single account', async () => {
    sharedServer.use(
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () =>
        HttpResponse.json({ items: [{ connectionId: 'conn_only', status: 'active', label: 'only' }] }),
      ),
    );

    const { findByTestId, getByTestId } = render(
      <PickerHarness>
        <Tools availableAgentTools={[checkedIntegrationTool]} />
      </PickerHarness>,
    );

    fireEvent.click(await findByTestId('toolkit-manage-composio-gmail'));

    // List is shown first even though there is only one account.
    await findByTestId('toolkit-manage-composio-gmail-list');
    fireEvent.click(getByTestId('toolkit-manage-composio-gmail-list-item-conn_only'));

    // The form has a back affordance to return to the list.
    await findByTestId('toolkit-manage-composio-gmail-input');
    getByTestId('toolkit-manage-composio-gmail-back');
    fireEvent.click(getByTestId('toolkit-manage-composio-gmail-back'));
    await findByTestId('toolkit-manage-composio-gmail-list');
  });

  it('opening the manage cog with multiple active connections shows a list, drilling into one to manage it', async () => {
    let items = [
      { connectionId: 'conn_work', status: 'active', label: 'work' },
      { connectionId: 'conn_personal', status: 'active', label: 'personal' },
    ];
    sharedServer.use(
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () => HttpResponse.json({ items })),
      http.delete(`${BASE_URL}/api/tool-providers/composio/connections/conn_work`, () => {
        items = items.filter(item => item.connectionId !== 'conn_work');
        return HttpResponse.json({ success: true });
      }),
    );

    const { findByTestId, getByTestId, queryByTestId } = render(
      <PickerHarness>
        <Tools availableAgentTools={[checkedIntegrationTool]} />
      </PickerHarness>,
    );

    fireEvent.click(await findByTestId('toolkit-manage-composio-gmail'));

    // Multiple accounts → a list is shown first, one row per connection.
    await findByTestId('toolkit-manage-composio-gmail-list');
    getByTestId('toolkit-manage-composio-gmail-list-item-conn_personal');

    // Drilling into one account shows the rename + disconnect form with a back affordance.
    fireEvent.click(getByTestId('toolkit-manage-composio-gmail-list-item-conn_work'));
    await findByTestId('toolkit-manage-composio-gmail-input');
    getByTestId('toolkit-manage-composio-gmail-back');

    // Back returns to the list without closing the dialog.
    fireEvent.click(getByTestId('toolkit-manage-composio-gmail-back'));
    await findByTestId('toolkit-manage-composio-gmail-list');

    // Disconnecting one of two accounts returns to the list, now showing only
    // the remaining account.
    fireEvent.click(getByTestId('toolkit-manage-composio-gmail-list-item-conn_work'));
    fireEvent.click(await findByTestId('toolkit-manage-composio-gmail-disconnect'));
    fireEvent.click(await findByTestId('toolkit-manage-composio-gmail-disconnect-confirm'));

    await findByTestId('toolkit-manage-composio-gmail-list');
    await waitFor(() => expect(queryByTestId('toolkit-manage-composio-gmail-list-item-conn_work')).toBeNull());
    getByTestId('toolkit-manage-composio-gmail-list-item-conn_personal');
  });

  it('pins the toolkit active connection into the form while a tool in the toolkit is selected', async () => {
    sharedServer.use(
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () =>
        HttpResponse.json({ items: [{ connectionId: 'conn_only', status: 'active', label: 'only' }] }),
      ),
    );

    const spy = vi.fn();
    const { findByTestId, getByTestId } = render(
      <PickerHarness onState={spy} defaultToolProviders={gmailToolSelected}>
        <Tools availableAgentTools={[checkedIntegrationTool]} />
      </PickerHarness>,
    );

    await findByTestId('toolkit-manage-composio-gmail');
    await waitFor(() => {
      fireEvent.click(getByTestId('spy-form-state'));
      const state = spy.mock.calls.at(-1)?.[0] as AgentBuilderEditFormValues;
      const pinned = (
        state as unknown as {
          toolProviders: { composio?: { connections?: { gmail?: Array<{ connectionId: string }> } } };
        }
      ).toolProviders.composio?.connections?.gmail;
      expect(pinned).toEqual([
        expect.objectContaining({ kind: 'author', toolkit: 'gmail', connectionId: 'conn_only' }),
      ]);
    });
  });

  it('pins every active connection while a tool in the toolkit is selected', async () => {
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
    const { findByTestId, getByTestId } = render(
      <PickerHarness onState={spy} defaultToolProviders={gmailToolSelected}>
        <Tools availableAgentTools={[checkedIntegrationTool]} />
      </PickerHarness>,
    );

    await findByTestId('toolkit-manage-composio-gmail');
    await waitFor(() => {
      fireEvent.click(getByTestId('spy-form-state'));
      const state = spy.mock.calls.at(-1)?.[0] as AgentBuilderEditFormValues;
      const pinned = (
        state as unknown as {
          toolProviders: { composio?: { connections?: { gmail?: Array<{ connectionId: string }> } } };
        }
      ).toolProviders.composio?.connections?.gmail;
      expect(pinned?.map(c => c.connectionId).sort()).toEqual(['conn_personal', 'conn_work']);
    });
  });

  it('renders the backend provider icon on the rename form when the toolkit has one', async () => {
    sharedServer.use(
      // Override the shared toolkit list so gmail carries an icon.
      http.get(`${BASE_URL}/api/tool-providers/composio/toolkits`, () => HttpResponse.json(composioToolkits)),
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () =>
        HttpResponse.json({ items: [{ connectionId: 'conn_only', status: 'active', label: 'only' }] }),
      ),
    );

    const { findByTestId, getByTestId } = render(
      <PickerHarness>
        <Tools availableAgentTools={[checkedIntegrationTool]} />
      </PickerHarness>,
    );

    fireEvent.click(await findByTestId('toolkit-manage-composio-gmail'));
    await findByTestId('toolkit-manage-composio-gmail-list');
    fireEvent.click(getByTestId('toolkit-manage-composio-gmail-list-item-conn_only'));

    // The rename form shows the resolved provider icon, not the generic fallback.
    const input = await findByTestId('toolkit-manage-composio-gmail-input');
    const form = input.closest('[data-testid="toolkit-manage-composio-gmail-dialog"]') as HTMLElement;
    const icon = form.querySelector('img') as HTMLImageElement;
    expect(icon).not.toBeNull();
    expect(icon.getAttribute('src')).toBe(GMAIL_ICON_URL);
  });

  it('shows an "Add connection" action on the list when the provider allows multiple connections', async () => {
    sharedServer.use(
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () =>
        HttpResponse.json({ items: [{ connectionId: 'conn_only', status: 'active', label: 'only' }] }),
      ),
    );

    const { findByTestId } = render(
      <PickerHarness>
        <Tools availableAgentTools={[checkedIntegrationTool]} />
      </PickerHarness>,
    );

    fireEvent.click(await findByTestId('toolkit-manage-composio-gmail'));
    await findByTestId('toolkit-manage-composio-gmail-list');

    // The provider supports multiple connections per toolkit, so the list
    // offers an add-connection action in the footer.
    await findByTestId('toolkit-manage-composio-gmail-add');
  });

  it('hides the "Add connection" action when the provider only allows a single connection', async () => {
    sharedServer.use(
      http.get(`${BASE_URL}/api/tool-providers`, () =>
        HttpResponse.json({
          providers: [{ id: 'composio', name: 'Composio', capabilities: { multipleConnectionsPerToolkit: false } }],
        }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/composio/connections`, () =>
        HttpResponse.json({ items: [{ connectionId: 'conn_only', status: 'active', label: 'only' }] }),
      ),
    );

    const { findByTestId, getByTestId, queryByTestId } = render(
      <PickerHarness>
        <Tools availableAgentTools={[checkedIntegrationTool]} />
      </PickerHarness>,
    );

    fireEvent.click(await findByTestId('toolkit-manage-composio-gmail'));
    getByTestId('toolkit-manage-composio-gmail-list');
    await waitFor(() => expect(queryByTestId('toolkit-manage-composio-gmail-add')).toBeNull());
  });
});
