import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { ScoreTraceDialog } from '../score-trace-dialog';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const SCORERS_URL = `${TEST_BASE_URL}/api/scores/scorers`;
const SCORE_URL = `${TEST_BASE_URL}/api/observability/traces/score`;

const scorers = {
  'answer-relevancy': {
    isRegistered: true,
    scorer: { config: { name: 'Answer relevancy', description: 'Checks the answer against the question.' } },
  },
  'agent-only': {
    isRegistered: true,
    scorer: { config: { name: 'Agent judge', type: 'agent' } },
  },
};

const renderDialog = (props?: { onScoringStarted?: () => void; isTopLevelSpan?: boolean }) =>
  renderWithProviders(
    <ScoreTraceDialog
      traceId="trace-1"
      spanId="span-1"
      isTopLevelSpan={props?.isTopLevelSpan ?? true}
      entityType="Agent"
      onScoringStarted={props?.onScoringStarted}
    />,
  );

const openDialog = () => fireEvent.click(screen.getByRole('button', { name: /score trace/i }));

const openScorerPicker = async () => {
  const picker = await screen.findByRole('combobox');
  await waitFor(() => expect(picker.hasAttribute('disabled')).toBe(false));
  fireEvent.click(picker);
  return picker;
};

const selectScorer = async (name: string) => {
  const option = await screen.findByRole('option', { name });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
};

describe('ScoreTraceDialog', () => {
  it('keeps the scorer picker behind the dialog', () => {
    server.use(http.get(SCORERS_URL, () => HttpResponse.json(scorers)));
    renderDialog();

    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('explains what scoring does once opened', async () => {
    server.use(http.get(SCORERS_URL, () => HttpResponse.json(scorers)));
    renderDialog();
    openDialog();

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/runs the selected scorer/i)).toBeTruthy();
  });

  it('triggers the selected scorer against the trace and hands over to the scores view', async () => {
    const onScoringStarted = vi.fn();
    const scoreRequest = vi.fn();
    server.use(
      http.get(SCORERS_URL, () => HttpResponse.json(scorers)),
      http.post(SCORE_URL, async ({ request }) => {
        scoreRequest(await request.json());
        return HttpResponse.json({ status: 'ok' });
      }),
    );

    renderDialog({ onScoringStarted });
    openDialog();

    await openScorerPicker();
    await selectScorer('Answer relevancy');
    fireEvent.click(screen.getByRole('button', { name: /start scoring/i }));

    await waitFor(() => expect(scoreRequest).toHaveBeenCalled());
    expect(scoreRequest.mock.calls[0][0]).toMatchObject({
      scorerName: 'answer-relevancy',
      targets: [{ traceId: 'trace-1', spanId: 'span-1' }],
    });
    await waitFor(() => expect(onScoringStarted).toHaveBeenCalledTimes(1));
    // Handing over to the scores view only makes sense once the dialog is out of the way.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('hides agent scorers when the span is not a top level agent run', async () => {
    server.use(http.get(SCORERS_URL, () => HttpResponse.json(scorers)));
    renderDialog({ isTopLevelSpan: false });
    openDialog();

    await openScorerPicker();
    expect(await screen.findByRole('option', { name: 'Answer relevancy' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'Agent judge' })).toBeNull();
  });
});
