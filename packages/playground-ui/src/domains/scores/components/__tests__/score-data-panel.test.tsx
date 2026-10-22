// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScoreDataPanel } from '../score-data-panel';
import { createScore } from './fixtures/score-as-item';
import { buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

beforeEach(() => {
  server.use(http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse())));
});

afterEach(() => cleanup());

function renderPanel(props: Partial<React.ComponentProps<typeof ScoreDataPanel>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();

  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <ScoreDataPanel score={createScore({ prompt: 'hi' }, { answer: 'ok' })} onClose={onClose} {...props} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  return { onClose };
}

describe('ScoreDataPanel', () => {
  describe('when a score is open', () => {
    it('closes the panel from the "Close score" button', async () => {
      const { onClose } = renderPanel();

      await userEvent.click(await screen.findByRole('button', { name: 'Close score' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not render the back-arrow close button', async () => {
      renderPanel();

      await screen.findByRole('button', { name: 'Close score' });
      expect(screen.queryByRole('button', { name: 'Close Panel' })).toBeNull();
    });
  });

  describe('when no previous/next handlers are given', () => {
    it('hides the score navigation', async () => {
      renderPanel();

      await screen.findByRole('button', { name: 'Close score' });
      expect(screen.queryByRole('button', { name: 'Go to next score' })).toBeNull();
    });
  });

  describe('when previous/next handlers are given', () => {
    it('shows the score navigation', async () => {
      renderPanel({ onPrevious: vi.fn(), onNext: vi.fn() });

      expect(await screen.findByRole('button', { name: 'Go to next score' })).toBeTruthy();
    });
  });
});
