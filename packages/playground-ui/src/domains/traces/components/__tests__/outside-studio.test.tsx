// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { FeedbackThread } from '../feedback-thread';
import { SpanDataPanelView } from '../span-data-panel-view';
import {
  toolCallsGenerationSpan,
  toolCallsTrace,
  TOOL_CALLS_TRACE_ID,
} from '../span-payload/__tests__/fixtures/span-tool-calls';
import { ThreadTrace } from '../thread-trace';
import type { ThreadTraceSelectedSpan } from '../thread-trace';
import { spanADetail, traceASpans, traceBSpans } from '../thread-trace/__tests__/fixtures/thread-trace';
import type { TraceNavigation } from '../trace-navigation';
import { TracePanel } from '../trace-panel';
import { agentTraceWithSubAgent, agentTraceWithTools, TRACE_THREAD_ITEM_ID } from './fixtures/trace-thread-item';
import { buildScore, listedScorers, scoresResponse } from '@/domains/scores/components/__tests__/fixtures/trace-scores';
import { TraceScoresListView } from '@/domains/scores/components/trace-scores-list-view';
import { TraceScoresTabView } from '@/domains/scores/components/trace-scores-tab-view';
import { feedbackRecord, listFeedbackResponse } from '@/domains/traces/hooks/__tests__/fixtures/trace-feedback';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { recordRequests } from '@/test/record-requests';

/*
 * The trace and thread panels, composed by an app that is not Studio (e.g. an MCP server app): no
 * Mastra client, no React Query, no Studio router, no provider at all. Every record comes from the app,
 * as typed by `@mastra/client-js`. A part that fetched, or that needed a Studio provider, fails here.
 */

// jsdom has no PointerEvent (Base UI tabs dispatch it) and no layout (rows scroll into view).
beforeAll(() => vi.stubGlobal('PointerEvent', MouseEvent));
afterAll(() => vi.unstubAllGlobals());
Element.prototype.scrollIntoView = vi.fn();

const turnSpans = [...agentTraceWithTools.spans, ...agentTraceWithSubAgent.spans.slice(1)];
const rootRecord = turnSpans[0];
if (!rootRecord) throw new Error('the turn must have a root span');

const traceFeedback = listFeedbackResponse([
  feedbackRecord({
    feedbackId: 'comment-1',
    traceId: TRACE_THREAD_ITEM_ID,
    feedbackType: 'comment',
    value: 'Too verbose',
  }),
]);
const traceScores = scoresResponse([
  buildScore({ traceId: TRACE_THREAD_ITEM_ID, spanId: rootRecord.spanId, reason: 'Answers the question' }),
]);

/** Where the app opens things: its own callbacks, no Studio route, no link component. */
const appNavigation = (): Required<TraceNavigation> => ({
  onOpenTrace: vi.fn(),
  onOpenAgent: vi.fn(),
  onOpenWorkflow: vi.fn(),
  onOpenTool: vi.fn(),
  onOpenWorkspace: vi.fn(),
  onOpenKnowledgePage: vi.fn(),
});

/** The trace panel with every part in its slot, fed by the app. */
function AppTracePanel({ navigation = appNavigation() }: { navigation?: TraceNavigation }) {
  const [spanId, setSpanId] = useState<string | undefined>();
  const [traceId, setTraceId] = useState<string | undefined>(TRACE_THREAD_ITEM_ID);
  return (
    <TracePanel
      traceId={traceId}
      spans={turnSpans}
      selectedSpanId={spanId}
      onSpanSelect={setSpanId}
      onClose={() => setTraceId(undefined)}
      navigation={navigation}
    >
      <TracePanel.Frame
        variant="inline"
        header={
          <TracePanel.Header
            navigation={<TracePanel.Navigation onPrevious={() => {}} onNext={() => {}} />}
            title={<TracePanel.TraceId />}
            actions={
              <>
                <TracePanel.ScoreButton />
                <TracePanel.DatasetButton onSaveAsDatasetItem={() => {}} />
                <TracePanel.OpenPageButton />
                <TracePanel.DownloadButton onDownload={() => {}} />
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
                messages={<TracePanel.Messages spans={turnSpans} onHighlightSpans={() => {}} />}
                feedback={<FeedbackThread feedbackData={traceFeedback} onSubmit={() => {}} />}
                feedbackCount={traceFeedback.pagination.total}
                scores={<TraceScoresTabView scores={traceScores} onScoreSelect={() => {}} onPageChange={() => {}} />}
                actions={<TracePanel.OpenFullThreadButton onClick={() => {}} />}
              />
            }
            main={
              <TracePanel.Main
                toolbar={
                  <TracePanel.SpansToolbar search={<TracePanel.Search />} actions={<TracePanel.SpanViewSwitch />} />
                }
                notices={<TracePanel.RootError />}
                spans={<TracePanel.Spans traceSpans={turnSpans} />}
              />
            }
            span={<TracePanel.SpanDetail span={rootRecord} traceSpans={turnSpans} onShowTrace={() => {}} />}
          />
        }
        dialogs={<TracePanel.ScoreDialog scorers={listedScorers} onTriggerScorer={async () => {}} />}
      />
    </TracePanel>
  );
}

/** The thread with every part of its rows in its slot, fed by the app. */
function AppThread({ navigation = appNavigation() }: { navigation?: TraceNavigation }) {
  const [selected, setSelected] = useState<ThreadTraceSelectedSpan | null>(null);
  const turns = [traceASpans, traceBSpans];
  return (
    <ThreadTrace
      navigation={navigation}
      traceIds={turns.map(turn => turn.traceId)}
      selectedSpan={selected}
      onSelectedSpanChange={setSelected}
      onLoadOlder={() => {}}
      spanDetail={<ThreadTrace.SpanDetail span={spanADetail.span} traceSpans={traceASpans.spans} />}
    >
      {turns.map((turn, index) => (
        <ThreadTrace.Row
          key={turn.traceId}
          traceId={turn.traceId}
          label={`Turn ${index + 1}`}
          link={<ThreadTrace.TraceLink />}
          messages={<ThreadTrace.TurnMessages spans={turn.spans} />}
          feedback={<FeedbackThread feedbackData={traceFeedback} onSubmit={() => {}} variant="thread" />}
          scores={<TraceScoresListView scores={traceScores} onScoreSelect={() => {}} onPageChange={() => {}} />}
          spans={<ThreadTrace.Spans spans={turn.spans} />}
        />
      ))}
    </ThreadTrace>
  );
}

const messagesPanel = () => screen.findByTestId('messages-panel');

/** Studio's link provider, rigged to throw the moment a part draws a link, builds a route or navigates through it. */
function StudioLinkTripwire({ children }: { children: ReactNode }) {
  const trip = (what: string) => () => {
    throw new Error(`A panel part used Studio's link provider: ${what}`);
  };
  const paths = new Proxy({} as LinkComponentProviderProps['paths'], {
    get: (_, route) => trip(`paths.${String(route)}`),
  });
  const Link = () => trip('Link')();
  return (
    <LinkComponentProvider Link={Link} navigate={trip('navigate')} paths={paths}>
      {children}
    </LinkComponentProvider>
  );
}
/** Opens a tool card on its input and result: its first button is the card's header. */
const expandCard = (card: HTMLElement) => {
  const [header] = within(card).getAllByRole('button');
  if (header) fireEvent.click(header);
};

describe('The trace and thread panels in an app other than Studio', () => {
  describe('when the app composes the trace panel from its own records', () => {
    it('opens the agent the trace ran, and its trace page, through the app', async () => {
      const navigation = appNavigation();
      render(<AppTracePanel navigation={navigation} />);

      fireEvent.click(await screen.findByRole('button', { name: /Travel Agent/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Open trace page' }));

      expect(navigation.onOpenAgent).toHaveBeenCalledWith('travel-agent');
      expect(navigation.onOpenTrace).toHaveBeenCalledWith(TRACE_THREAD_ITEM_ID);
    });

    it('draws no link: the app navigates', async () => {
      const { container } = render(<AppTracePanel />);

      const messages = await messagesPanel();
      expandCard(within(messages).getByTestId('agent-badge'));
      within(messages).getAllByTestId('tool-badge').forEach(expandCard);
      fireEvent.click(screen.getByLabelText('View details for span Travel agent run'));
      for (const tab of ['Input', 'Output']) fireEvent.click(screen.getByRole('tab', { name: new RegExp(tab) }));

      expect(container.ownerDocument.querySelectorAll('a')).toHaveLength(0);
    });

    it('never reaches for Studio’s link provider', async () => {
      render(
        <StudioLinkTripwire>
          <AppTracePanel />
        </StudioLinkTripwire>,
      );

      const messages = await messagesPanel();
      within(messages).getAllByTestId('tool-badge').forEach(expandCard);
      fireEvent.click(screen.getByLabelText('View details for span Travel agent run'));

      expect(await screen.findByRole('region', { name: 'Travel Agent' })).toBeTruthy();
    });

    it('draws the span tree', async () => {
      render(<AppTracePanel />);

      expect(await screen.findByLabelText('View details for span Travel agent run')).toBeTruthy();
    });

    it('rebuilds the turn, its text and every tool call it made', async () => {
      render(<AppTracePanel />);

      const messages = await messagesPanel();

      expect(within(messages).getByText('Plan a weekend in Paris')).toBeTruthy();
      expect(within(messages).getByText('Your Paris itinerary is ready.')).toBeTruthy();
      // Cards title a call by its tool, humanized: `searchHotels` reads "SearchHotels".
      expect(within(messages).getByText(/searchHotels/i)).toBeTruthy();
      expect(within(messages).getByText(/tripPlanner/i)).toBeTruthy();
      expect(within(messages).getByText(/weatherAgent/i)).toBeTruthy();
    });

    it('shows what the sub-agent answered, from the trace', async () => {
      render(<AppTracePanel />);

      const messages = await messagesPanel();
      expandCard(within(messages).getByTestId('agent-badge'));

      expect(await within(messages).findByText('Sunny all weekend.')).toBeTruthy();
    });

    it('shows the feedback and the scores the app handed in', async () => {
      render(<AppTracePanel />);

      fireEvent.click(await screen.findByRole('tab', { name: /Feedback/ }));
      expect(await screen.findByText('Too verbose')).toBeTruthy();

      fireEvent.click(screen.getByRole('tab', { name: /Scores/ }));
      expect(await screen.findByText('Answers the question')).toBeTruthy();
    });

    it('opens a span with its Details, Input and Output', async () => {
      render(<AppTracePanel />);

      fireEvent.click(await screen.findByLabelText('View details for span Travel agent run'));
      const detail = await screen.findByRole('region', { name: 'Travel Agent' });

      for (const tab of ['Input', 'Output', 'Details']) {
        fireEvent.click(within(detail).getByRole('tab', { name: new RegExp(tab) }));
      }
      expect(
        within(detail)
          .getByRole('tab', { name: /Details/ })
          .getAttribute('aria-selected'),
      ).toBe('true');
    });

    it('offers the app’s scorers', async () => {
      render(<AppTracePanel />);

      fireEvent.click(await screen.findByRole('button', { name: 'Score trace' }));

      expect(await screen.findByRole('dialog', { name: 'Score trace' })).toBeTruthy();
    });

    it('sends no request', async () => {
      const requests = recordRequests();
      render(<AppTracePanel />);

      const messages = await messagesPanel();
      expandCard(within(messages).getByTestId('agent-badge'));
      within(messages).getAllByTestId('tool-badge').forEach(expandCard);
      fireEvent.click(await screen.findByLabelText('View details for span Travel agent run'));
      fireEvent.click(screen.getByRole('tab', { name: /Feedback/ }));
      fireEvent.click(screen.getByRole('tab', { name: /Scores/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Score trace' }));
      await screen.findByRole('dialog', { name: 'Score trace' });

      expect(requests).toEqual([]);
    });
  });

  describe('when the app opens a generation that called tools', () => {
    const renderGeneration = () =>
      render(
        <SpanDataPanelView
          traceId={TOOL_CALLS_TRACE_ID}
          spanId={toolCallsGenerationSpan.spanId}
          span={toolCallsGenerationSpan}
          traceSpans={toolCallsTrace.spans}
          activeTab="output"
        />,
      );

    it('pairs each tool call with the result its tool span recorded', async () => {
      renderGeneration();

      const [paris] = await screen.findAllByTestId('tool-badge');
      if (!paris) throw new Error('the generation shows no tool call');
      expandCard(paris);

      expect(await screen.findByText(/Overcast/)).toBeTruthy();
    });

    it('sends no request', async () => {
      const requests = recordRequests();
      renderGeneration();

      (await screen.findAllByTestId('tool-badge')).forEach(expandCard);

      expect(requests).toEqual([]);
    });
  });

  describe('when the app composes the thread from its own records', () => {
    it('draws one row per turn, with its messages and its spans', async () => {
      render(<AppThread />);

      expect(await screen.findByText('cook pasta')).toBeTruthy();
      expect(screen.getByText('carbonara')).toBeTruthy();
      expect(screen.getByLabelText('View details for span Chef agent follow-up')).toBeTruthy();
    });

    it('opens a turn’s trace through the app', async () => {
      const navigation = appNavigation();
      render(<AppThread navigation={navigation} />);

      const [, secondTurn] = await screen.findAllByRole('button', { name: 'Go to trace' });
      if (!secondTurn) throw new Error('the second turn has no Go to trace');
      fireEvent.click(secondTurn);

      expect(navigation.onOpenTrace).toHaveBeenCalledWith('trace-b');
    });

    it('draws no link: the app navigates', async () => {
      const { container } = render(<AppThread />);

      await screen.findByText('cook pasta');
      fireEvent.click(screen.getByLabelText('View details for span Recipe lookup'));
      await screen.findByRole('region', { name: 'Chef agent run' });

      expect(container.ownerDocument.querySelectorAll('a')).toHaveLength(0);
    });

    it('never reaches for Studio’s link provider', async () => {
      render(
        <StudioLinkTripwire>
          <AppThread />
        </StudioLinkTripwire>,
      );

      fireEvent.click(await screen.findByLabelText('View details for span Recipe lookup'));

      expect(await screen.findByRole('region', { name: 'Chef agent run' })).toBeTruthy();
    });

    it('opens the span the reader clicks beside the turns', async () => {
      render(<AppThread />);

      fireEvent.click(await screen.findByLabelText('View details for span Recipe lookup'));

      expect(await screen.findByRole('region', { name: 'Chef agent run' })).toBeTruthy();
    });

    it('sends no request', async () => {
      const requests = recordRequests();
      render(<AppThread />);

      await screen.findByText('cook pasta');
      const [firstRow] = screen.getAllByRole('tablist');
      if (!firstRow) throw new Error('the first turn has no tabs');
      fireEvent.click(within(firstRow).getByRole('tab', { name: /Feedback/ }));
      expect(await screen.findByText('Too verbose')).toBeTruthy();
      fireEvent.click(within(firstRow).getByRole('tab', { name: /Scores/ }));
      // The list folds each reason behind its button; the scorer names the score.
      expect(await screen.findByText('Answer relevancy')).toBeTruthy();
      fireEvent.click(screen.getByLabelText('View details for span Recipe lookup'));
      await screen.findByRole('region', { name: 'Chef agent run' });

      expect(requests).toEqual([]);
    });
  });
});
