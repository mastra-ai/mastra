// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { SpanScoring } from '../span-scoring';
import type { SpanScoringProps } from '../span-scoring';
import { listedScorers } from './fixtures/trace-scores';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import { recordRequests } from '@/test/record-requests';
import { renderWithProviders } from '@/test/render';

// Base UI comboboxes dispatch pointer events, which jsdom does not provide.
beforeAll(() => vi.stubGlobal('PointerEvent', MouseEvent));
afterAll(() => vi.unstubAllGlobals());

type TriggerScorer = SpanScoringProps['onTriggerScorer'];

const renderScoring = (props: Partial<SpanScoringProps> = {}) =>
  renderWithProviders(
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Score trace</DialogTitle>
        </DialogHeader>
        <SpanScoring
          traceId="trace-1"
          spanId="root"
          entityType="Agent"
          isTopLevelSpan
          scorers={listedScorers}
          onTriggerScorer={() => Promise.resolve()}
          {...props}
        />
      </DialogContent>
    </Dialog>,
  );

const scorerOptions = async () => {
  fireEvent.click(screen.getByRole('combobox', { name: 'Select scorer' }));
  return (await screen.findAllByRole('option')).map(option => option.textContent);
};

const startScoring = async (scorerName: string) => {
  fireEvent.click(screen.getByRole('combobox', { name: 'Select scorer' }));
  fireEvent.click(await screen.findByRole('option', { name: scorerName }));
  fireEvent.click(screen.getByRole('button', { name: 'Start scoring' }));
};

describe('SpanScoring', () => {
  describe('when the scorers come from the props', () => {
    it('offers every registered scorer', async () => {
      renderScoring();

      expect(await scorerOptions()).toEqual(['Helpfulness', 'Answer relevancy']);
    });

    it('starts the picked scorer on the span through onTriggerScorer', async () => {
      const onTriggerScorer = vi.fn<TriggerScorer>(() => Promise.resolve());
      renderScoring({ onTriggerScorer });

      await startScoring('Helpfulness');

      expect(onTriggerScorer).toHaveBeenCalledWith({ scorerName: 'helpfulness', traceId: 'trace-1', spanId: 'root' });
    });

    it('reports success once the host started it', async () => {
      const onSuccess = vi.fn();
      renderScoring({ onSuccess });

      await startScoring('Helpfulness');

      await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    });

    it('sends no request to the Mastra server', async () => {
      const requests = recordRequests();
      renderScoring();

      await startScoring('Helpfulness');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Start scoring' })).toBeTruthy());

      expect(requests).toEqual([]);
    });
  });

  describe('when the host could not start the scorer', () => {
    it('does not report success', async () => {
      const onSuccess = vi.fn();
      renderScoring({ onSuccess, onTriggerScorer: () => Promise.reject(new Error('scorer offline')) });

      await startScoring('Helpfulness');

      await waitFor(() => expect(screen.getByRole('button', { name: 'Start scoring' })).toBeTruthy());
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('when the span is not a top-level agent run', () => {
    it('leaves agent scorers out', async () => {
      renderScoring({ isTopLevelSpan: false });

      expect(await scorerOptions()).toEqual(['Helpfulness']);
    });
  });

  describe('when the host is still listing scorers', () => {
    it('keeps the picker disabled', () => {
      renderScoring({ scorers: undefined, isLoadingScorers: true });

      expect(screen.getByRole('combobox', { name: 'Select scorer' }).hasAttribute('disabled')).toBe(true);
    });
  });

  describe('when the host failed to list scorers', () => {
    it('says so', () => {
      renderScoring({ scorers: undefined });

      expect(screen.getByText('Failed to load scorers.')).toBeTruthy();
    });
  });
});
