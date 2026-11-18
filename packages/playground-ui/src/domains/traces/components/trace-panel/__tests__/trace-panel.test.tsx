// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { TRACE_ID, panelTraceSpans, spanDetailById } from '../../__tests__/fixtures/trace-span-panel';
import { TracePanel } from '../index';
import type { TracePanelRootProps } from '../index';
import { panelScorers, skillSignalTraceSpans } from './fixtures/trace-panel';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { recordRequests } from '@/test/record-requests';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

// jsdom reports zero-sized elements; give them a real size so the virtualized span tree
// materializes its rows.
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
  // Base UI comboboxes dispatch pointer events, which jsdom does not provide.
  vi.stubGlobal('PointerEvent', MouseEvent);
});
afterAll(() => {
  if (originalOffsetHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
  if (originalOffsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
  vi.unstubAllGlobals();
});

/** The chat message renderer resolves MCP app tools; it belongs to the chat domain, not to this panel. */
const MCP_APP_TOOLS_LOOKUP = '/api/mcp/v0/servers';
const serveMcpAppToolsLookup = () =>
  server.use(http.get(`${TEST_BASE_URL}${MCP_APP_TOOLS_LOOKUP}`, () => HttpResponse.json({ servers: [] })));

/** The root as a host mounts it: selection is the host's state, the parts sit in a drawer frame, a dialog next to it. */
function Panel({
  children,
  dialog,
  initialSpanId,
  onSpanSelect,
  ...props
}: Partial<TracePanelRootProps> & { children: ReactNode; dialog?: ReactNode; initialSpanId?: string }) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>(initialSpanId);
  return (
    <TracePanel
      traceId={TRACE_ID}
      spans={panelTraceSpans.spans}
      selectedSpanId={selectedSpanId}
      onSpanSelect={spanId => {
        setSelectedSpanId(spanId);
        onSpanSelect?.(spanId);
      }}
      onClose={() => {}}
      {...props}
    >
      <TracePanel.Frame>{children}</TracePanel.Frame>
      {dialog}
    </TracePanel>
  );
}

/** The span tree, which every composition below draws in the main column. */
const SpanTree = (props: Partial<Parameters<typeof TracePanel.Spans>[0]>) => (
  <TracePanel.Main>
    <TracePanel.SpansToolbar>
      <TracePanel.Search />
      <TracePanel.SpanViewSwitch />
    </TracePanel.SpansToolbar>
    <TracePanel.Spans {...props} />
  </TracePanel.Main>
);

const render = (ui: ReactNode) => renderWithProviders(<TestLinkProvider>{ui}</TestLinkProvider>);

/** A span row in the tree, not the open span panel's header that repeats its title. */
const treeRow = (title: string) => screen.getByLabelText(`View details for span ${title}`);

describe('TracePanel', () => {
  describe('when the host composes the panel with the data it loaded', () => {
    const composeEverything = () =>
      render(
        <Panel initialSpanId="child1">
          <TracePanel.Header>
            <TracePanel.Navigation onPrevious={() => {}} onNext={() => {}} />
            <TracePanel.TraceId />
            <TracePanel.Actions>
              <TracePanel.DownloadButton onDownload={() => {}} />
              <TracePanel.CloseButton />
            </TracePanel.Actions>
          </TracePanel.Header>
          <TracePanel.Summary />
          <TracePanel.Body>
            <TracePanel.Side defaultView="messages">
              <TracePanel.SideHeader>
                <TracePanel.SideTabs>
                  <TracePanel.MessagesTab />
                  <TracePanel.FeedbackTab count={2} />
                </TracePanel.SideTabs>
              </TracePanel.SideHeader>
              <TracePanel.Messages spans={panelTraceSpans.spans} />
              <TracePanel.Feedback>
                <p>Host feedback</p>
              </TracePanel.Feedback>
            </TracePanel.Side>
            <SpanTree traceSpans={panelTraceSpans.spans} />
            <TracePanel.SpanPanel>
              <TracePanel.SpanDetail span={spanDetailById.child1?.span} traceSpans={panelTraceSpans.spans} />
            </TracePanel.SpanPanel>
          </TracePanel.Body>
        </Panel>,
      );

    it('draws the span tree from the spans given to the root', async () => {
      serveMcpAppToolsLookup();
      composeEverything();

      expect(await screen.findByLabelText('View details for span Root agent run')).toBeTruthy();
      expect(treeRow('Second tool call')).toBeTruthy();
    });

    it('shows the selected span record given to the span detail', async () => {
      serveMcpAppToolsLookup();
      composeEverything();

      const detail = await screen.findByRole('region', { name: 'First tool call' });

      expect(within(detail).getByText('session-42')).toBeTruthy();
    });

    it('reconstructs the turn from the full trace given to the Messages part', async () => {
      serveMcpAppToolsLookup();
      composeEverything();

      const messages = await screen.findByTestId('messages-panel');

      expect(await within(messages).findByText('No rain is expected.')).toBeTruthy();
    });

    it('shows what the host renders in the Feedback part on its tab', async () => {
      serveMcpAppToolsLookup();
      composeEverything();

      fireEvent.click(await screen.findByRole('tab', { name: /Feedback/ }));

      expect(await screen.findByText('Host feedback')).toBeTruthy();
    });

    it('asks the network for nothing but the chat renderer’s MCP app tools', async () => {
      serveMcpAppToolsLookup();
      const requests = recordRequests();
      const { queryClient } = composeEverything();

      await screen.findByText('No rain is expected.');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));

      expect(requests.filter(path => path !== MCP_APP_TOOLS_LOOKUP)).toEqual([]);
    });
  });

  describe('when the host frames the panel inline', () => {
    it('draws it where it is mounted, as a card rather than a drawer', async () => {
      render(
        <TracePanel traceId={TRACE_ID} spans={panelTraceSpans.spans} onClose={() => {}}>
          <TracePanel.Frame variant="inline">
            <TracePanel.Header>
              <TracePanel.TraceId />
            </TracePanel.Header>
            <TracePanel.Body>
              <SpanTree />
            </TracePanel.Body>
          </TracePanel.Frame>
        </TracePanel>,
      );

      expect(await screen.findByLabelText('View details for span Root agent run')).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('region', { name: `Trace ${TRACE_ID}` })).toBeTruthy();
    });
  });

  describe('when the host leaves a part out', () => {
    it('draws no side column without TracePanel.Side', async () => {
      render(
        <Panel>
          <TracePanel.Body>
            <SpanTree />
          </TracePanel.Body>
        </Panel>,
      );

      await screen.findByLabelText('View details for span Root agent run');

      expect(document.querySelector('[data-trace-side-column]')).toBeNull();
      expect(screen.queryByRole('tab', { name: /Messages/ })).toBeNull();
    });

    it('draws no span column without TracePanel.SpanPanel, even with a span selected', async () => {
      render(
        <Panel initialSpanId="child1">
          <TracePanel.Body>
            <SpanTree />
          </TracePanel.Body>
        </Panel>,
      );

      await screen.findByLabelText('View details for span Root agent run');

      expect(document.querySelector('[data-slot="span-data-panel"]')).toBeNull();
    });

    it('offers no download without TracePanel.DownloadButton', async () => {
      render(
        <Panel>
          <TracePanel.Header>
            <TracePanel.Actions>
              <TracePanel.CloseButton />
            </TracePanel.Actions>
          </TracePanel.Header>
          <TracePanel.Body>
            <SpanTree />
          </TracePanel.Body>
        </Panel>,
      );

      await screen.findByLabelText('View details for span Root agent run');

      expect(screen.queryByRole('button', { name: 'Download trace JSON' })).toBeNull();
    });
  });

  describe('when the host adds its own parts', () => {
    it('renders its action among the standard ones', async () => {
      render(
        <Panel>
          <TracePanel.Header>
            <TracePanel.Actions>
              <button type="button">Replay trace</button>
              <TracePanel.CloseButton />
            </TracePanel.Actions>
          </TracePanel.Header>
          <TracePanel.Body>
            <SpanTree />
          </TracePanel.Body>
        </Panel>,
      );

      expect(await screen.findByRole('button', { name: 'Replay trace' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Close trace' })).toBeTruthy();
    });

    it('opens its own side view from its own tab', async () => {
      render(
        <Panel>
          <TracePanel.Body>
            <TracePanel.Side defaultView="feedback">
              <TracePanel.SideHeader>
                <TracePanel.SideTabs>
                  <TracePanel.FeedbackTab />
                  <TracePanel.SideTab value="notes" label="Notes" icon={<span />} />
                </TracePanel.SideTabs>
              </TracePanel.SideHeader>
              <TracePanel.Feedback>
                <p>Host feedback</p>
              </TracePanel.Feedback>
              <TracePanel.SideContent value="notes">
                <p>Host notes</p>
              </TracePanel.SideContent>
            </TracePanel.Side>
            <SpanTree />
          </TracePanel.Body>
        </Panel>,
      );

      fireEvent.click(await screen.findByRole('tab', { name: /Notes/ }));

      expect(await screen.findByText('Host notes')).toBeTruthy();
      expect(screen.queryByText('Host feedback')).toBeNull();
    });
  });

  describe('when the host hands the full trace to the span tree', () => {
    it('badges the run a skill signal started with that skill', async () => {
      render(
        <Panel>
          <TracePanel.Body>
            <SpanTree traceSpans={skillSignalTraceSpans} />
          </TracePanel.Body>
        </Panel>,
      );

      const badge = await waitFor(() => {
        const element = document.querySelector('[data-slot="span-signal-badge"]');
        if (!element) throw new Error('no signal badge yet');
        return element;
      });

      expect(badge.textContent).toBe('Skill weather-check');
    });
  });

  describe('when the reader opens and closes a span', () => {
    it('reports the selection to the host', async () => {
      const onSpanSelect = vi.fn<(spanId: string | undefined) => void>();
      render(
        <Panel onSpanSelect={onSpanSelect}>
          <TracePanel.Body>
            <SpanTree />
          </TracePanel.Body>
        </Panel>,
      );

      fireEvent.click(await screen.findByLabelText('View details for span First tool call'));

      expect(onSpanSelect).toHaveBeenLastCalledWith('child1');
    });

    it('closes the span through the span detail', async () => {
      const onSpanSelect = vi.fn<(spanId: string | undefined) => void>();
      render(
        <Panel initialSpanId="child1" onSpanSelect={onSpanSelect}>
          <TracePanel.Body>
            <SpanTree />
            <TracePanel.SpanPanel>
              <TracePanel.SpanDetail span={spanDetailById.child1?.span} />
            </TracePanel.SpanPanel>
          </TracePanel.Body>
        </Panel>,
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Close span' }));

      expect(onSpanSelect).toHaveBeenLastCalledWith(undefined);
    });
  });

  describe('when the host can start scorers', () => {
    it('starts the picked scorer on the root span and opens the Scores view', async () => {
      const onTriggerScorer = vi.fn(() => Promise.resolve());
      render(
        <Panel dialog={<TracePanel.ScoreDialog scorers={panelScorers} onTriggerScorer={onTriggerScorer} />}>
          <TracePanel.Header>
            <TracePanel.Actions>
              <TracePanel.ScoreButton />
            </TracePanel.Actions>
          </TracePanel.Header>
          <TracePanel.Body>
            <TracePanel.Side defaultView="feedback">
              <TracePanel.SideHeader>
                <TracePanel.SideTabs>
                  <TracePanel.FeedbackTab />
                  <TracePanel.ScoresTab />
                </TracePanel.SideTabs>
              </TracePanel.SideHeader>
              <TracePanel.Feedback>
                <p>Host feedback</p>
              </TracePanel.Feedback>
              <TracePanel.Scores>
                <p>Host scores</p>
              </TracePanel.Scores>
            </TracePanel.Side>
            <SpanTree />
          </TracePanel.Body>
        </Panel>,
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Score trace' }));
      const dialog = await screen.findByRole('dialog', { name: 'Score trace' });
      fireEvent.click(within(dialog).getByRole('combobox', { name: 'Select scorer' }));
      fireEvent.click(await screen.findByRole('option', { name: 'Helpfulness' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Start scoring' }));

      await waitFor(() =>
        expect(onTriggerScorer).toHaveBeenCalledWith({
          scorerName: 'helpfulness',
          traceId: TRACE_ID,
          spanId: 'root01',
        }),
      );
      expect(await screen.findByText('Host scores')).toBeTruthy();
    });
  });

  describe('when the host can download the trace', () => {
    it('downloads it through onDownload', async () => {
      const onDownload = vi.fn<(traceId: string) => void>();
      render(
        <Panel>
          <TracePanel.Header>
            <TracePanel.Actions>
              <TracePanel.DownloadButton onDownload={onDownload} />
            </TracePanel.Actions>
          </TracePanel.Header>
        </Panel>,
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Download trace JSON' }));

      expect(onDownload).toHaveBeenCalledWith(TRACE_ID);
    });
  });

  describe('when the host searches the spans itself', () => {
    it('draws only the matches it hands down, keeping their ancestors', async () => {
      const [root, childOne] = panelTraceSpans.spans;
      if (!root || !childOne) throw new Error('fixture spans missing');
      render(
        <Panel searchQuery="first" onSearchQueryChange={() => {}}>
          <TracePanel.Body>
            <SpanTree results={{ results: [root, childOne], payloadOnlyMatchIds: new Set() }} />
          </TracePanel.Body>
        </Panel>,
      );

      await screen.findByLabelText('View details for span First tool call');

      expect(screen.queryByLabelText('View details for span Second tool call')).toBeNull();
    });

    it('reports what the reader types through onSearchQueryChange', async () => {
      const onSearchQueryChange = vi.fn<(query: string) => void>();
      render(
        <Panel searchQuery="" onSearchQueryChange={onSearchQueryChange}>
          <TracePanel.Body>
            <SpanTree />
          </TracePanel.Body>
        </Panel>,
      );

      fireEvent.change(await screen.findByRole('searchbox', { name: 'Search spans' }), { target: { value: 'tool' } });

      expect(onSearchQueryChange).toHaveBeenCalledWith('tool');
    });
  });

  describe('when the host says the thread has more turns', () => {
    it('opens the full thread through its side action', async () => {
      serveMcpAppToolsLookup();
      const onOpenFullThread = vi.fn();
      render(
        <Panel>
          <TracePanel.Body>
            <TracePanel.Side defaultView="messages">
              <TracePanel.SideHeader>
                <TracePanel.SideTabs>
                  <TracePanel.MessagesTab />
                </TracePanel.SideTabs>
                <TracePanel.SideActions>
                  <TracePanel.OpenFullThreadButton onClick={onOpenFullThread} />
                </TracePanel.SideActions>
              </TracePanel.SideHeader>
              <TracePanel.Messages spans={panelTraceSpans.spans} />
            </TracePanel.Side>
            <SpanTree />
          </TracePanel.Body>
        </Panel>,
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Open full thread' }));

      expect(onOpenFullThread).toHaveBeenCalledOnce();
    });
  });
});
