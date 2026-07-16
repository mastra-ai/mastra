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

      expect(screen.getByRole('heading', { name: 'Understand what drives every agent interaction' })).not.toBeNull();

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

    it('defines each supported signal in plain language', () => {
      render(<SignalsOverviewPage />);

      const definitions = screen.getByRole('list', { name: 'Signal definitions' });
      expect(within(definitions).getByText(/what the user is trying to achieve or have completed/i)).not.toBeNull();
      expect(within(definitions).getByText(/the user's emotional state or attitude/i)).not.toBeNull();
      expect(
        within(definitions).getByText(
          /observable actions and patterns, including tool use, omissions, retries, failures, and recovery/i,
        ),
      ).not.toBeNull();
      expect(within(definitions).getByText(/the final completed, unresolved, or blocked state/i)).not.toBeNull();
    });

    it('previews grouped relationships and offers persistent activation actions', () => {
      render(<SignalsOverviewPage />);

      expect(screen.getByText(/grouped trace relationships will appear here/i)).not.toBeNull();
      expect(screen.getByText('Waiting for traces.')).not.toBeNull();

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
