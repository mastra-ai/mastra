// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { fireEvent, render as renderUI, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { TRACE_ID, panelTraceSpans, spanDetailById } from '../../__tests__/fixtures/trace-span-panel';
import { TracePanel } from '../index';
import type { TracePanelFrameProps, TracePanelRootProps } from '../index';
import { panelScorers, skillSignalTraceSpans } from './fixtures/trace-panel';
import { recordRequests } from '@/test/record-requests';

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

/** The main column most compositions below use: search, layout switch and the span tree. */
const spanTree = (props: Partial<Parameters<typeof TracePanel.Spans>[0]> = {}) => (
  <TracePanel.Main
    toolbar={<TracePanel.SpansToolbar search={<TracePanel.Search />} actions={<TracePanel.SpanViewSwitch />} />}
    spans={<TracePanel.Spans {...props} />}
  />
);

type PanelProps = Partial<TracePanelRootProps> & Omit<TracePanelFrameProps, 'title'> & { initialSpanId?: string };

/** A host: span selection is its state, the slots are whatever it composes. */
function Panel({
  initialSpanId,
  onSpanSelect,
  variant,
  size,
  depth,
  banner,
  header,
  summary,
  body,
  dialogs,
  ...props
}: PanelProps) {
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
      <TracePanel.Frame
        variant={variant}
        size={size}
        depth={depth}
        banner={banner}
        header={header}
        summary={summary}
        body={body ?? <TracePanel.Body main={spanTree()} />}
        dialogs={dialogs}
      />
    </TracePanel>
  );
}

// No Mastra client, no React Query, no Studio router: the panel draws what it is given and needs nothing else.
const render = (ui: ReactNode) => renderUI(ui);
const treeRow = (title: string) => screen.findByLabelText(`View details for span ${title}`);

describe('TracePanel', () => {
  describe('when the host fills every slot with the data it loaded', () => {
    const composeEverything = () =>
      render(
        <Panel
          initialSpanId="child1"
          header={
            <TracePanel.Header
              navigation={<TracePanel.Navigation onPrevious={() => {}} onNext={() => {}} />}
              title={<TracePanel.TraceId />}
              actions={
                <>
                  <TracePanel.DownloadButton onDownload={() => {}} />
                  <TracePanel.CloseButton />
                </>
              }
            />
          }
          summary={
            <TracePanel.Summary
              entity={<TracePanel.Entity />}
              status={<TracePanel.Status />}
              stats={<TracePanel.Stats />}
            />
          }
          body={
            <TracePanel.Body
              side={
                <TracePanel.Side
                  messages={<TracePanel.Messages spans={panelTraceSpans.spans} />}
                  feedback={<p>Host feedback</p>}
                  feedbackCount={2}
                />
              }
              main={spanTree({ traceSpans: panelTraceSpans.spans })}
              span={<TracePanel.SpanDetail span={spanDetailById.child1?.span} traceSpans={panelTraceSpans.spans} />}
            />
          }
        />,
      );

    it('draws the span tree from the spans given to the root', async () => {
      composeEverything();

      expect(await treeRow('Root agent run')).toBeTruthy();
      expect(await treeRow('Second tool call')).toBeTruthy();
    });

    it('shows the selected span record given to the span slot', async () => {
      composeEverything();

      const detail = await screen.findByRole('region', { name: 'First tool call' });

      expect(within(detail).getByText('session-42')).toBeTruthy();
    });

    it('reconstructs the turn from the full trace given to the messages slot', async () => {
      composeEverything();

      const messages = await screen.findByTestId('messages-panel');

      expect(await within(messages).findByText('No rain is expected.')).toBeTruthy();
    });

    it('offers one side tab per filled view slot, with its count', async () => {
      composeEverything();

      await screen.findByTestId('messages-panel');

      // The span detail has tabs of its own: only the side column's tab list is read.
      const sideTabs = screen.getByRole('tab', { name: 'Messages' }).closest<HTMLElement>('[role="tablist"]');
      if (!sideTabs) throw new Error('the side column has no tab list');

      expect(
        within(sideTabs)
          .getAllByRole('tab')
          .map(tab => tab.textContent),
      ).toEqual(['Messages', 'Feedback (2)']);
    });

    it('shows what the host put in the feedback slot on its tab', async () => {
      composeEverything();

      fireEvent.click(await screen.findByRole('tab', { name: /Feedback/ }));

      expect(await screen.findByText('Host feedback')).toBeTruthy();
    });

    it('summarizes what ran and how it ended from the root span', async () => {
      composeEverything();

      expect(await screen.findByLabelText('Trace status')).toBeTruthy();
      expect(screen.getByText('Weather Agent')).toBeTruthy();
    });

    it('asks the network for nothing', async () => {
      const requests = recordRequests();
      composeEverything();

      await screen.findByText('No rain is expected.');

      expect(requests).toEqual([]);
    });
  });

  describe('when the host leaves a slot empty', () => {
    it('draws no side column without the side slot', async () => {
      render(<Panel />);

      await treeRow('Root agent run');

      expect(document.querySelector('[data-trace-side-column]')).toBeNull();
      expect(screen.queryByRole('tab')).toBeNull();
    });

    it('draws no span column without the span slot, even with a span selected', async () => {
      render(<Panel initialSpanId="child1" />);

      await treeRow('Root agent run');

      expect(document.querySelector('[data-slot="span-data-panel"]')).toBeNull();
    });

    it('draws no span column while no span is selected, even with the span slot', async () => {
      // A host element: it would show if the column did, since nothing in it reads the selection.
      render(<Panel body={<TracePanel.Body main={spanTree()} span={<p>Host span detail</p>} />} />);

      await treeRow('Root agent run');

      expect(screen.queryByText('Host span detail')).toBeNull();
    });

    it('draws the span slot once the reader opens a span', async () => {
      render(<Panel body={<TracePanel.Body main={spanTree()} span={<p>Host span detail</p>} />} />);

      fireEvent.click(await treeRow('First tool call'));

      expect(await screen.findByText('Host span detail')).toBeTruthy();
    });

    it('offers no tab for a side view slot left empty', async () => {
      render(
        <Panel body={<TracePanel.Body side={<TracePanel.Side scores={<p>Host scores</p>} />} main={spanTree()} />} />,
      );

      await screen.findByText('Host scores');

      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Scores']);
    });

    it('draws no header without the header slot', async () => {
      render(<Panel />);

      await treeRow('Root agent run');

      expect(screen.queryByRole('button', { name: 'Close trace' })).toBeNull();
    });

    it('offers no download without the download action', async () => {
      render(<Panel header={<TracePanel.Header actions={<TracePanel.CloseButton />} />} />);

      await treeRow('Root agent run');

      expect(screen.queryByRole('button', { name: 'Download trace JSON' })).toBeNull();
    });

    it('draws only the summary parts the host put in', async () => {
      render(<Panel summary={<TracePanel.Summary status={<TracePanel.Status />} />} />);

      expect(await screen.findByLabelText('Trace status')).toBeTruthy();
      expect(screen.queryByText('Weather Agent')).toBeNull();
    });
  });

  describe('when the host navigates', () => {
    const navigation = () => ({ onOpenAgent: vi.fn(), onOpenWorkflow: vi.fn(), onOpenTrace: vi.fn() });
    const renderNavigable = (props: Partial<PanelProps> = {}) =>
      render(
        <Panel
          header={<TracePanel.Header title={<TracePanel.TraceId />} actions={<TracePanel.OpenPageButton />} />}
          summary={<TracePanel.Summary entity={<TracePanel.Entity />} />}
          {...props}
        />,
      );

    it('opens the agent the trace ran through onOpenAgent', async () => {
      const host = navigation();
      renderNavigable({ navigation: host });

      fireEvent.click(await screen.findByRole('button', { name: /Weather Agent/ }));

      expect(host.onOpenAgent).toHaveBeenCalledWith('weather-agent');
    });

    it('opens the trace on its own page through onOpenTrace', async () => {
      const host = navigation();
      renderNavigable({ navigation: host });

      fireEvent.click(await screen.findByRole('button', { name: 'Open trace page' }));

      expect(host.onOpenTrace).toHaveBeenCalledWith(TRACE_ID);
    });

    it('draws no link: every navigation goes through the host', async () => {
      const { container } = renderNavigable({ navigation: navigation() });

      await screen.findByRole('button', { name: /Weather Agent/ });

      expect(container.ownerDocument.querySelectorAll('a')).toHaveLength(0);
    });

    describe('when the host does not navigate', () => {
      it('shows the entity as text', async () => {
        renderNavigable();

        expect(await screen.findByText('Weather Agent')).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Weather Agent/ })).toBeNull();
      });

      it('offers no trace page', async () => {
        renderNavigable();

        await screen.findByText('Weather Agent');

        expect(screen.queryByRole('button', { name: 'Open trace page' })).toBeNull();
      });
    });
  });

  describe('when the host puts its own elements in the slots', () => {
    it('renders its action among the standard ones', async () => {
      render(
        <Panel
          header={
            <TracePanel.Header
              actions={
                <>
                  <button type="button">Replay trace</button>
                  <TracePanel.CloseButton />
                </>
              }
            />
          }
        />,
      );

      expect(await screen.findByRole('button', { name: 'Replay trace' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Close trace' })).toBeTruthy();
    });

    it('renders its banner above the header', async () => {
      render(
        <Panel banner={<p>Opened from feedback</p>} header={<TracePanel.Header title={<TracePanel.TraceId />} />} />,
      );

      const banner = await screen.findByText('Opened from feedback');
      const heading = screen.getByRole('heading', { name: /Trace/ });

      expect(banner.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('renders its own side column in place of the standard one', async () => {
      render(<Panel body={<TracePanel.Body side={<aside>Host notes</aside>} main={spanTree()} />} />);

      expect(await screen.findByText('Host notes')).toBeTruthy();
    });

    it('renders its notices above the spans', async () => {
      render(
        <Panel
          body={
            <TracePanel.Body main={<TracePanel.Main notices={<p>Sampled trace</p>} spans={<TracePanel.Spans />} />} />
          }
        />,
      );

      const notice = await screen.findByText('Sampled trace');
      const firstRow = await treeRow('Root agent run');

      expect(notice.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('renders its cell at the end of each span row', async () => {
      render(
        <Panel
          body={
            <TracePanel.Body
              main={
                <TracePanel.Main
                  spans={<TracePanel.Spans renderRowTrailing={({ span }) => <span>cost of {span.name}</span>} />}
                />
              }
            />
          }
        />,
      );

      expect(await screen.findByText('cost of First tool call')).toBeTruthy();
    });

    it('renders its element above the span rows', async () => {
      render(
        <Panel
          body={<TracePanel.Body main={<TracePanel.Main spans={<TracePanel.Spans leading={<p>Legend</p>} />} />} />}
        />,
      );

      expect(await screen.findByText('Legend')).toBeTruthy();
    });
  });

  describe('when the host frames the panel inline', () => {
    it('draws it where it is mounted, as a card rather than a drawer', async () => {
      render(<Panel variant="inline" header={<TracePanel.Header title={<TracePanel.TraceId />} />} />);

      expect(await treeRow('Root agent run')).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('region', { name: `Trace ${TRACE_ID}` })).toBeTruthy();
    });
  });

  describe('when the host hands the full trace to the span tree', () => {
    it('badges the run a skill signal started with that skill', async () => {
      render(<Panel body={<TracePanel.Body main={spanTree({ traceSpans: skillSignalTraceSpans })} />} />);

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
      render(<Panel onSpanSelect={onSpanSelect} />);

      fireEvent.click(await treeRow('First tool call'));

      expect(onSpanSelect).toHaveBeenLastCalledWith('child1');
    });

    it('closes the span through the span detail', async () => {
      const onSpanSelect = vi.fn<(spanId: string | undefined) => void>();
      render(
        <Panel
          initialSpanId="child1"
          onSpanSelect={onSpanSelect}
          body={
            <TracePanel.Body main={spanTree()} span={<TracePanel.SpanDetail span={spanDetailById.child1?.span} />} />
          }
        />,
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Close span' }));

      expect(onSpanSelect).toHaveBeenLastCalledWith(undefined);
    });
  });

  describe('when the host can start scorers', () => {
    const composeScoring = (side: ReactNode) => {
      const onTriggerScorer = vi.fn(() => Promise.resolve());
      render(
        <Panel
          header={<TracePanel.Header actions={<TracePanel.ScoreButton />} />}
          dialogs={<TracePanel.ScoreDialog scorers={panelScorers} onTriggerScorer={onTriggerScorer} />}
          body={<TracePanel.Body side={side} main={spanTree()} />}
        />,
      );
      return { onTriggerScorer };
    };

    const scoreWithHelpfulness = async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Score trace' }));
      const dialog = await screen.findByRole('dialog', { name: 'Score trace' });
      fireEvent.click(within(dialog).getByRole('combobox', { name: 'Select scorer' }));
      fireEvent.click(await screen.findByRole('option', { name: 'Helpfulness' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Start scoring' }));
    };

    it('starts the picked scorer on the root span', async () => {
      const { onTriggerScorer } = composeScoring(undefined);

      await scoreWithHelpfulness();

      await waitFor(() =>
        expect(onTriggerScorer).toHaveBeenCalledWith({
          scorerName: 'helpfulness',
          traceId: TRACE_ID,
          spanId: 'root01',
        }),
      );
    });

    it('opens the Scores view once the scorer started', async () => {
      composeScoring(<TracePanel.Side feedback={<p>Host feedback</p>} scores={<p>Host scores</p>} />);
      await screen.findByText('Host feedback');

      await scoreWithHelpfulness();

      expect(await screen.findByText('Host scores')).toBeTruthy();
    });

    it('stays on the open view when the side column offers no Scores', async () => {
      composeScoring(<TracePanel.Side feedback={<p>Host feedback</p>} />);
      await screen.findByText('Host feedback');

      await scoreWithHelpfulness();

      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Score trace' })).toBeNull());
      expect(screen.getByText('Host feedback')).toBeTruthy();
    });
  });

  describe('when the host can download the trace', () => {
    it('downloads it through onDownload', async () => {
      const onDownload = vi.fn<(traceId: string) => void>();
      render(<Panel header={<TracePanel.Header actions={<TracePanel.DownloadButton onDownload={onDownload} />} />} />);

      fireEvent.click(await screen.findByRole('button', { name: 'Download trace JSON' }));

      expect(onDownload).toHaveBeenCalledWith(TRACE_ID);
    });
  });

  describe('when the host searches the spans itself', () => {
    it('draws only the matches it hands down, keeping their ancestors', async () => {
      const [root, childOne] = panelTraceSpans.spans;
      if (!root || !childOne) throw new Error('fixture spans missing');
      render(
        <Panel
          searchQuery="first"
          onSearchQueryChange={() => {}}
          body={
            <TracePanel.Body
              main={spanTree({ results: { results: [root, childOne], payloadOnlyMatchIds: new Set() } })}
            />
          }
        />,
      );

      await treeRow('First tool call');

      expect(screen.queryByLabelText('View details for span Second tool call')).toBeNull();
    });

    it('reports what the reader types through onSearchQueryChange', async () => {
      const onSearchQueryChange = vi.fn<(query: string) => void>();
      render(<Panel searchQuery="" onSearchQueryChange={onSearchQueryChange} />);

      fireEvent.change(await screen.findByRole('searchbox', { name: 'Search spans' }), { target: { value: 'tool' } });

      expect(onSearchQueryChange).toHaveBeenCalledWith('tool');
    });
  });

  describe('when the host says the thread has more turns', () => {
    it('opens the full thread through the side column’s action', async () => {
      const onOpenFullThread = vi.fn();
      render(
        <Panel
          body={
            <TracePanel.Body
              side={
                <TracePanel.Side
                  messages={<TracePanel.Messages spans={panelTraceSpans.spans} />}
                  actions={<TracePanel.OpenFullThreadButton onClick={onOpenFullThread} />}
                />
              }
              main={spanTree()}
            />
          }
        />,
      );

      fireEvent.click(await screen.findByRole('button', { name: 'Open full thread' }));

      expect(onOpenFullThread).toHaveBeenCalledOnce();
    });
  });

  describe('when the trace has no spans', () => {
    it('says so in place of the main column', async () => {
      render(<Panel spans={[]} />);

      expect(await screen.findByText('No spans found for this trace.')).toBeTruthy();
      expect(screen.queryByRole('searchbox', { name: 'Search spans' })).toBeNull();
    });
  });
});
