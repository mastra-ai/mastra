// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import type { ComponentProps } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { panelScorers } from '../trace-panel/__tests__/fixtures/trace-panel';
import { TraceSpanPanel } from '../trace-span-panel';
import type { TraceSpanPanelProps } from '../trace-span-panel';
import { queryPageFromList } from './fixtures/thread-traces';
import {
  TRACE_ID,
  panelTraceSpans,
  scoreStarted,
  skillSignalRootDetail,
  spanDetailById,
} from './fixtures/trace-span-panel';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { recordRequests } from '@/test/record-requests';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

// jsdom reports zero-sized elements; give them a real size so the virtualized
// timeline materializes its rows.
const originalOffsetHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'offsetHeight',
) as PropertyDescriptor;
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth') as PropertyDescriptor;
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
});
afterAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
});

/** A span row in the tree, not the open span panel's header that repeats its title. */
const treeRow = (title: string) => {
  const row = screen.getAllByText(title).find(element => !element.closest('[data-slot="span-data-panel"]'));
  if (!row) throw new Error(`No tree row titled ${title}`);
  return row;
};

/** The open span panel, once its header shows the given span title. */
const spanPanelTitled = async (title: string) => {
  return screen.findByRole('region', { name: title });
};

const onSpanDetailRequest = vi.fn<(spanId: string) => void>();

const threadTraceList = (count: number) => ({
  spans: Array.from({ length: count }, (_, i) => ({ ...panelTraceSpans.spans[0], traceId: `thread-trace-${i}` })),
  pagination: { page: 0, perPage: 25, total: count, hasMore: false },
});

const installHandlers = ({ threadTraceCount = 2 }: { threadTraceCount?: number } = {}) => {
  onSpanDetailRequest.mockClear();
  server.use(
    http.post(`${TEST_BASE_URL}/api/observability/traces/query`, () =>
      HttpResponse.json(queryPageFromList(threadTraceList(threadTraceCount))),
    ),
    // Registered before the `:traceId` route so the literal `traces/light` segment wins.
    http.get(`${TEST_BASE_URL}/api/observability/traces/light`, () =>
      HttpResponse.json(threadTraceList(threadTraceCount)),
    ),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/spans/:spanId`, ({ params }) => {
      const spanId = String(params.spanId);
      onSpanDetailRequest(spanId);
      const detail = spanDetailById[spanId];
      return detail ? HttpResponse.json(detail) : HttpResponse.json({ error: 'not found' }, { status: 404 });
    }),
    http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(panelTraceSpans)),
    http.get(`${TEST_BASE_URL}/api/observability/feedback`, () =>
      HttpResponse.json({ feedback: [], pagination: { page: 0, perPage: 10, total: 0, hasMore: false } }),
    ),
    http.get(`${TEST_BASE_URL}/api/mcp/v0/servers`, () => HttpResponse.json({ servers: [], totalCount: 0 })),
    http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json({})),
    http.get(`${TEST_BASE_URL}/api/tools`, () => HttpResponse.json({})),
  );
};

/**
 * Controlled-selection harness: the panel is controlled by its parent in both real
 * call sites (URL state on the traces page, local state in the chat aside).
 */
function Harness({
  initialSpanId = null,
  onSpanSelect,
  ...props
}: Partial<TraceSpanPanelProps> & { initialSpanId?: string | null }) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(initialSpanId);
  return (
    <TraceSpanPanel
      traceId={TRACE_ID}
      spans={panelTraceSpans.spans}
      isLoadingSpans={false}
      selectedSpanId={selectedSpanId}
      onSpanSelect={spanId => {
        setSelectedSpanId(spanId ?? null);
        onSpanSelect?.(spanId);
      }}
      onClose={() => {}}
      {...props}
    />
  );
}

const renderPanel = (
  props: Partial<TraceSpanPanelProps> & { initialSpanId?: string | null } = {},
  paths?: ComponentProps<typeof TestLinkProvider>['paths'],
  navigate?: ComponentProps<typeof TestLinkProvider>['navigate'],
) =>
  renderWithProviders(
    <TestLinkProvider paths={paths} navigate={navigate}>
      <Harness {...props} />
    </TestLinkProvider>,
  );

describe('TraceSpanPanel', () => {
  // Each part loads what it draws when it shows, not when the panel mounts: the MCP app tools cost a
  // request per MCP server, and the traces page keeps this panel mounted while it is closed.
  describe('when it loads what a part needs', () => {
    const MCP_APP_TOOLS = '/api/mcp/v0/servers';
    const TOOL_REGISTRY = '/api/tools';
    const settle = async (queryClient: { isFetching: () => number }) => {
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    };

    it('loads no MCP app tools while the panel is closed', async () => {
      installHandlers();
      const requests = recordRequests();
      const { queryClient } = renderPanel({ traceId: undefined });

      await settle(queryClient);

      expect(requests).not.toContain(MCP_APP_TOOLS);
    });

    it('loads no MCP app tools for a trace shown without its messages', async () => {
      installHandlers();
      const requests = recordRequests();
      const { queryClient } = renderPanel();

      await screen.findByLabelText('View details for span Root agent run');
      await settle(queryClient);

      expect(requests).not.toContain(MCP_APP_TOOLS);
    });

    it('loads the MCP app tools once the turn’s messages show', async () => {
      installHandlers();
      const requests = recordRequests();
      renderPanel({ showPartialThread: true });

      await screen.findByTestId('messages-panel');

      await waitFor(() => expect(requests).toContain(MCP_APP_TOOLS));
    });

    /** The opened span offered the model a tool, as a model span records it. */
    const offeringTools = () =>
      server.use(
        http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/spans/:spanId`, () =>
          HttpResponse.json({
            span: {
              ...spanDetailById.child1.span,
              attributes: { tools: [{ type: 'function', name: 'weatherInfo', description: 'Weather of a city.' }] },
            },
          }),
        ),
      );

    it('loads the tool registry once the Input tab of a span that offered tools opens', async () => {
      installHandlers();
      offeringTools();
      const requests = recordRequests();
      const { queryClient } = renderPanel({ initialSpanId: 'child1' });

      await screen.findByRole('region', { name: 'First tool call' });
      await settle(queryClient);
      expect(requests).not.toContain(TOOL_REGISTRY);

      fireEvent.click(screen.getByRole('tab', { name: /^Input/ }));

      await waitFor(() => expect(requests).toContain(TOOL_REGISTRY));
    });

    it('loads no tool registry for a span that offered no tools, even on its Input tab', async () => {
      installHandlers();
      const requests = recordRequests();
      const { queryClient } = renderPanel({ initialSpanId: 'child1' });

      await screen.findByRole('region', { name: 'First tool call' });
      fireEvent.click(screen.getByRole('tab', { name: /^Input/ }));
      await settle(queryClient);

      expect(requests).not.toContain(TOOL_REGISTRY);
    });
  });

  describe('given partial thread is enabled for an agent trace with a thread id', () => {
    it('when rendered, then the Messages column shows the chat turn without any tab click', async () => {
      installHandlers();
      const { queryClient } = renderPanel({ showPartialThread: true });

      expect(await screen.findByTestId('messages-panel')).not.toBeNull();
      expect(screen.queryByRole('tab', { name: 'Spans' })).toBeNull();
      expect(await screen.findByText('Will it rain?')).not.toBeNull();
      expect(screen.getByText('No rain is expected.')).not.toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });

    it('reports the spans behind each message when the highlight action is clicked', async () => {
      installHandlers();
      const onHighlightSpans = vi.fn();
      const { queryClient } = renderPanel({ showPartialThread: true, onHighlightSpans });

      await screen.findByText('No rain is expected.');

      // One action per message: user, the two tool calls, and the assistant reply.
      const actions = screen.getAllByRole('button', { name: 'Highlight spans' });
      expect(actions).toHaveLength(4);
      const [userAction, , , assistantAction] = actions;
      if (!userAction || !assistantAction) throw new Error('expected one highlight action per message');

      fireEvent.click(assistantAction);
      expect(onHighlightSpans).toHaveBeenCalledWith(['root01']);

      fireEvent.click(userAction);
      expect(onHighlightSpans).toHaveBeenLastCalledWith(['root01']);
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });

    describe('when the thread has other traces and the host can show it', () => {
      it('hands the thread id to the host from "Open full thread"', async () => {
        installHandlers({ threadTraceCount: 2 });
        const onOpenFullThread = vi.fn<(threadId: string) => void>();
        const { queryClient } = renderPanel({ showPartialThread: true, onOpenFullThread });

        const button = await screen.findByRole('button', { name: 'Open full thread' });
        // The action sits in the side column's tab row, not inside the conversation.
        expect(screen.getByTestId('messages-panel').contains(button)).toBe(false);
        expect(button.closest('[data-trace-side-column]')).not.toBeNull();

        fireEvent.click(button);
        expect(onOpenFullThread).toHaveBeenCalledWith('weather-thread');
        await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      });

      it('renders no thread drawer of its own: the host decides where the thread shows', async () => {
        installHandlers({ threadTraceCount: 2 });
        const { queryClient } = renderPanel({ showPartialThread: true, onOpenFullThread: vi.fn() });

        fireEvent.click(await screen.findByRole('button', { name: 'Open full thread' }));
        await waitFor(() => expect(queryClient.isFetching()).toBe(0));

        expect(screen.queryByRole('dialog', { name: /^Thread / })).toBeNull();
      });
    });

    describe('when the thread has other traces but the host cannot show it', () => {
      it('offers no "Open full thread"', async () => {
        installHandlers({ threadTraceCount: 2 });
        const { queryClient } = renderPanel({ showPartialThread: true });

        await screen.findByText('No rain is expected.');
        await waitFor(() => expect(queryClient.isFetching()).toBe(0));

        expect(screen.queryByRole('button', { name: 'Open full thread' })).toBeNull();
      });
    });

    describe('when this trace is the only one in its thread', () => {
      it('offers no "Open full thread"', async () => {
        installHandlers({ threadTraceCount: 1 });
        const { queryClient } = renderPanel({ showPartialThread: true, onOpenFullThread: vi.fn() });

        await screen.findByText('No rain is expected.');
        await waitFor(() => expect(queryClient.isFetching()).toBe(0));

        expect(screen.queryByRole('button', { name: 'Open full thread' })).toBeNull();
      });
    });

    it('does not render the highlight action when no handler is provided', async () => {
      installHandlers();
      const { queryClient } = renderPanel({ showPartialThread: true });

      await screen.findByText('No rain is expected.');

      expect(screen.queryByRole('button', { name: 'Highlight spans' })).toBeNull();
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    });
  });

  it('fades timeline spans that are not featured', async () => {
    installHandlers();
    const { queryClient } = renderPanel({ featuredSpanIds: ['root01'] });

    await screen.findByLabelText('View details for span Root agent run');
    expect(screen.getByLabelText('View details for span Root agent run').className).not.toContain('opacity-30');
    expect(screen.getByLabelText('View details for span First tool call').className).toContain('opacity-30');
    expect(screen.getByLabelText('View details for span Second tool call').className).toContain('opacity-30');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  describe('given partial thread is enabled without a complete agent thread context', () => {
    it('when the trace has no thread id, then the Messages column is absent', () => {
      installHandlers();
      renderPanel({
        showPartialThread: true,
        spans: panelTraceSpans.spans.map(span => (span.parentSpanId == null ? { ...span, threadId: null } : span)),
      });

      expect(screen.queryByRole('heading', { name: 'Messages' })).toBeNull();
    });

    it('when viewing a branch, then the Messages column is absent', () => {
      installHandlers();
      renderPanel({ showPartialThread: true, anchorSpanId: 'root01' });

      expect(screen.queryByRole('heading', { name: 'Messages' })).toBeNull();
    });
  });

  it('given a trace with spans, when it renders, then the trace header and span tree are shown', async () => {
    installHandlers();
    const { queryClient } = renderPanel();

    expect(await screen.findByRole('heading', { name: `Trace ${TRACE_ID.slice(0, 6)}` })).not.toBeNull();
    expect(screen.getByText('Root agent run')).not.toBeNull();
    expect(screen.getByText('First tool call')).not.toBeNull();
    expect(screen.getByText('Second tool call')).not.toBeNull();
    // No span selected → no span detail panel.
    expect(document.querySelector('[data-slot="span-data-panel"]')).toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('when a span is clicked, then the span detail panel opens with data fetched from the API', async () => {
    installHandlers();
    const onSpanSelect = vi.fn<(spanId: string | undefined) => void>();
    const { queryClient } = renderPanel({ onSpanSelect });

    fireEvent.click(await screen.findByText('First tool call'));

    expect(onSpanSelect).toHaveBeenCalledWith('child1');
    expect(await spanPanelTitled('First tool call')).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(onSpanDetailRequest).toHaveBeenCalledWith('child1');
  });

  it('when a span is open, then it has no next/previous buttons and the tree switches spans', async () => {
    installHandlers();
    const { queryClient } = renderPanel({ initialSpanId: 'child1' });

    expect(await spanPanelTitled('First tool call')).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(screen.queryByLabelText('Go to next span')).toBeNull();
    expect(screen.queryByLabelText('Go to previous span')).toBeNull();

    fireEvent.click(treeRow('Second tool call'));
    expect(await spanPanelTitled('Second tool call')).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('when the selected run was started by a skill signal, then its input shows the skill instead of the raw signal', async () => {
    installHandlers();
    server.use(
      http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId/spans/root01`, () =>
        HttpResponse.json(skillSignalRootDetail),
      ),
    );
    const { queryClient } = renderPanel({ initialSpanId: 'root01' });

    fireEvent.click(await screen.findByRole('tab', { name: /^Input/ }));
    const skill = await screen.findByLabelText('Skill: weather-check');
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(skill.textContent).toContain('weather-check Paris');
    expect(screen.getByText('Check the forecast before answering.')).not.toBeNull();
    expect(document.body.textContent).not.toContain('[Function]');
  });

  it('when a skill signal started the run, then its row in the span tree is badged with the skill', async () => {
    installHandlers();
    server.use(
      http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () =>
        HttpResponse.json({
          ...panelTraceSpans,
          spans: panelTraceSpans.spans.map(span => (span.spanId === 'root01' ? skillSignalRootDetail.span : span)),
        }),
      ),
    );
    const { queryClient } = renderPanel();

    const badge = await waitFor(() => {
      const element = document.querySelector('[data-slot="span-signal-badge"]');
      expect(element).not.toBeNull();
      return element;
    });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    expect(badge?.textContent).toBe('Skill weather-check');
    expect(badge?.closest('[aria-label="View details for span Root agent run"]')).not.toBeNull();
    expect(document.querySelectorAll('[data-slot="span-signal-badge"]')).toHaveLength(1);
  });

  it('when the selected span is clicked again, then onSpanSelect(undefined) clears the selection', async () => {
    installHandlers();
    const onSpanSelect = vi.fn<(spanId: string | undefined) => void>();
    const { queryClient } = renderPanel({ initialSpanId: 'child1', onSpanSelect });

    expect(await spanPanelTitled('First tool call')).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    // The span column has no close button: clicking the selected span row again toggles it off.
    fireEvent.click(treeRow('First tool call'));

    expect(onSpanSelect).toHaveBeenCalledWith(undefined);
    await waitFor(() => expect(document.querySelector('[data-slot="span-data-panel"]')).toBeNull());
  });

  it('when the trace panel is closed, then onClose is called', async () => {
    installHandlers();
    const onClose = vi.fn();
    const { queryClient } = renderPanel({ onClose });

    expect(await screen.findByRole('heading', { name: `Trace ${TRACE_ID.slice(0, 6)}` })).not.toBeNull();
    fireEvent.click(screen.getByLabelText('Close trace'));
    expect(onClose).toHaveBeenCalledOnce();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it('given an agent root span, then the trace summary shows the entity opening its agent page, start time, duration, and a Spans tab', async () => {
    installHandlers();
    const navigate = vi.fn();
    const { queryClient } = renderPanel({}, undefined, navigate);

    expect(await screen.findByRole('heading', { name: `Trace ${TRACE_ID.slice(0, 6)}` })).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));

    // Entity block: Studio opens the agent page through its router.
    fireEvent.click(screen.getByRole('button', { name: /Weather Agent/ }));
    expect(navigate).toHaveBeenCalledWith('/agents/weather-agent');

    // Start time + duration are shown; the old key-value rows are gone.
    expect(screen.getByLabelText(/^Started at /)).not.toBeNull();
    // ("1s" also appears as the root span's duration in the tree, so allow multiple matches.)
    expect(screen.getAllByText('1s').length).toBeGreaterThan(0);
    expect(screen.queryByText('Status')).toBeNull();
    expect(screen.queryByText('Ended at')).toBeNull();
    // Tab labels ("Spans") only render when score/feedback slots are provided;
    // that rendering is covered by the playground-ui unit tests.
  });

  it('given a workflow root span, then the entity opens its workflow graph', async () => {
    installHandlers();
    const navigate = vi.fn();
    renderPanel(
      {
        spans: panelTraceSpans.spans.map(span =>
          span.parentSpanId == null
            ? { ...span, entityType: 'workflow_run', entityId: 'daily-report', entityName: 'Daily report' }
            : span,
        ),
      },
      undefined,
      navigate,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Daily report/ }));
    expect(navigate).toHaveBeenCalledWith('/workflows/daily-report');
  });

  const withRootEntity = (entityType: string, entityId: string, entityName: string) =>
    panelTraceSpans.spans.map(span =>
      span.parentSpanId == null ? { ...span, entityType, entityId, entityName } : span,
    );

  it('given the app has no agent route, then the agent entity is shown as text', async () => {
    installHandlers();
    renderPanel({ spans: withRootEntity('agent_run', 'chef', 'Chef agent') }, { agentLink: () => '' });

    expect(await screen.findByText(/Chef agent/)).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Chef agent/ })).toBeNull();
  });

  it('given the app has no workflow route, then the workflow entity is shown as text', async () => {
    installHandlers();
    renderPanel({ spans: withRootEntity('workflow_run', 'daily-report', 'Daily report') }, { workflowLink: () => '' });

    expect(await screen.findByText(/Daily report/)).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Daily report/ })).toBeNull();
  });

  it('given a span with a parent, then its Details tab still lists the trace-level ids it carries', async () => {
    installHandlers();
    const { queryClient } = renderPanel({ anchorSpanId: 'child1', initialSpanId: 'child1' });

    expect(await spanPanelTitled('First tool call')).not.toBeNull();
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    const details = screen.getByRole('tabpanel', { name: 'Details' });
    expect(within(details).getByText('Session')).not.toBeNull();
    expect(within(details).getByText('session-42')).not.toBeNull();
    expect(within(details).getByRole('button', { name: 'Copy Session id' })).not.toBeNull();
  });

  describe('when the reader scores the trace', () => {
    beforeEach(() => vi.stubGlobal('PointerEvent', MouseEvent));
    afterEach(() => vi.unstubAllGlobals());

    it('starts the picked scorer on the root span through the Mastra server', async () => {
      installHandlers();
      const onScore = vi.fn<(body: unknown) => void>();
      server.use(
        http.get(`${TEST_BASE_URL}/api/scores/scorers`, () => HttpResponse.json(panelScorers)),
        http.post(`${TEST_BASE_URL}/api/observability/traces/score`, async ({ request }) => {
          onScore(await request.json());
          return HttpResponse.json(scoreStarted);
        }),
      );
      const { queryClient } = renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: 'Score trace' }));
      const dialog = await screen.findByRole('dialog', { name: 'Score trace' });
      fireEvent.click(within(dialog).getByRole('combobox', { name: 'Select scorer' }));
      fireEvent.click(await screen.findByRole('option', { name: 'Helpfulness' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Start scoring' }));

      await waitFor(() =>
        expect(onScore).toHaveBeenCalledWith({
          scorerName: 'helpfulness',
          targets: [{ traceId: TRACE_ID, spanId: 'root01' }],
        }),
      );
      await waitFor(() => expect(queryClient.isMutating()).toBe(0));
    });
  });

  describe('resizable columns', () => {
    // Resize handles are direct children of the column group; nested decorative separators are excluded.
    const resizeHandles = () => {
      const group = document.querySelector('[data-trace-columns]')?.firstElementChild;
      return Array.from(group?.children ?? []).filter(el => el.getAttribute('role') === 'separator');
    };
    const columns = () => Array.from(document.querySelectorAll('[data-trace-columns] [data-panel]'));

    it('when the trace has a thread, then one resize handle splits Messages and trace', async () => {
      installHandlers();
      const { queryClient } = renderPanel({ showPartialThread: true });

      await screen.findByTestId('messages-panel');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(screen.getAllByRole('separator')).toHaveLength(1);
      expect(resizeHandles()).toHaveLength(1);
      expect(columns()).toHaveLength(2);
    });

    it('when a span is selected, then a third column appears behind a second resize handle', async () => {
      installHandlers();
      const { queryClient } = renderPanel({ showPartialThread: true, initialSpanId: 'root01' });

      await screen.findByTestId('messages-panel');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      await waitFor(() => expect(screen.getAllByRole('separator')).toHaveLength(2));
      expect(resizeHandles()).toHaveLength(2);
      expect(columns()).toHaveLength(3);
      expect(document.querySelector('[data-panel][id="trace-span"]')).not.toBeNull();
    });
  });
});
