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

      const pipeline = screen.getByRole('list', { name: 'Signals analysis pipeline' });
      const stageHeadings = within(pipeline)
        .getAllByRole('heading')
        .map(heading => heading.textContent);
      expect(stageHeadings).toEqual(['Traces', 'Mastra Engine', 'Signal analysis']);

      for (const signal of ['Outcome', 'Goal', 'Behavior', 'Sentiment']) {
        expect(within(pipeline).getByText(signal)).not.toBeNull();
      }
    });

    it('previews the future analysis and offers persistent activation actions', () => {
      render(<SignalsOverviewPage />);

      expect(screen.getByText('Your analysis will appear here')).not.toBeNull();

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
