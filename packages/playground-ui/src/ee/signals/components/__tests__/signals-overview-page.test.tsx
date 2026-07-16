// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SignalsEmptyState } from '../signals-empty-state';
import { SignalsOverviewPage } from '../signals-overview-page';

afterEach(() => cleanup());

describe('SignalsOverviewPage', () => {
  describe('when Signals has not launched yet', () => {
    it('explains the ordered trace analysis pipeline and its four signal dimensions', () => {
      render(<SignalsOverviewPage />);

      expect(screen.getByText('SIGNALS')).not.toBeNull();
      expect(screen.getByRole('heading', { name: 'Understand what drives every agent interaction' })).not.toBeNull();
      expect(
        screen.getByText(/Mastra observes your traces, groups recurring patterns, and turns them into signals/),
      ).not.toBeNull();

      const pipeline = screen.getByRole('list', { name: 'Signals analysis pipeline' });
      const stageHeadings = within(pipeline)
        .getAllByRole('heading')
        .map(heading => heading.textContent);
      expect(stageHeadings).toEqual(['Traces', 'Mastra Engine', 'Signal analysis']);

      expect(within(pipeline).getByText(/input/i)).not.toBeNull();
      expect(within(pipeline).getByText(/output/i)).not.toBeNull();
      expect(within(pipeline).getByText('Clusters recurring patterns')).not.toBeNull();
      expect(within(pipeline).getByText('What your users actually do')).not.toBeNull();

      for (const [trace, duration] of [
        ['chat.completion', '1.2s'],
        ['tool.search_docs', '340ms'],
        ['workflow.support', '2.8s'],
      ]) {
        expect(within(pipeline).getByText(trace)).not.toBeNull();
        expect(within(pipeline).getByText(duration)).not.toBeNull();
      }

      for (const signal of ['Outcome', 'Goal', 'Behavior', 'Sentiment']) {
        expect(within(pipeline).getByText(signal)).not.toBeNull();
      }
    });

    it('previews grouped relationships and offers persistent activation actions', () => {
      render(<SignalsOverviewPage />);

      expect(screen.getByText(/grouped trace relationships will appear here/i)).not.toBeNull();
      expect(screen.getByText('Waiting for traces.')).not.toBeNull();
      expect(
        screen.getByText(/Signals activate automatically once your agents start receiving traffic/),
      ).not.toBeNull();

      const docsLink = screen.getByRole('link', { name: 'Read the docs' });
      expect(docsLink.getAttribute('href')).toBe('https://mastra.ai/en/docs/observability/tracing/overview');
      expect(docsLink.getAttribute('target')).toBe('_blank');
      expect(docsLink.getAttribute('rel')).toBe('noopener noreferrer');

      expect(screen.getByRole('link', { name: 'View incoming traces' }).getAttribute('href')).toBe('/observability');
    });
  });
});

describe('SignalsEmptyState', () => {
  describe('when a custom action is supplied', () => {
    it('renders it alongside the persistent activation actions', () => {
      render(<SignalsEmptyState actionSlot={<button type="button">Choose an agent</button>} />);

      expect(screen.getByRole('button', { name: 'Choose an agent' })).not.toBeNull();
      expect(screen.getByRole('link', { name: 'Read the docs' })).not.toBeNull();
      expect(screen.getByRole('link', { name: 'View incoming traces' })).not.toBeNull();
    });
  });
});
