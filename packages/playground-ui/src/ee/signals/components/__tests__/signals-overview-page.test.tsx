// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SignalsEmptyState } from '../signals-empty-state';
import { SignalsOverviewPage } from '../signals-overview-page';

afterEach(() => cleanup());

describe('SignalsOverviewPage', () => {
  describe('when Signals has not launched yet', () => {
    it('explains the purpose of signal analysis', () => {
      render(<SignalsOverviewPage />);

      expect(screen.getByRole('heading', { name: 'Understand what drives every agent interaction' })).not.toBeNull();
    });

    it('shows the ordered trace analysis pipeline', () => {
      render(<SignalsOverviewPage />);

      const pipeline = screen.getByRole('list', { name: 'Signals analysis pipeline' });
      const stageHeadings = within(pipeline)
        .getAllByRole('heading')
        .map(heading => heading.textContent);

      expect(stageHeadings).toEqual(['Traces', 'Mastra Engine', 'Signal analysis']);
    });

    it('shows representative trace inputs', () => {
      render(<SignalsOverviewPage />);

      const pipeline = screen.getByRole('list', { name: 'Signals analysis pipeline' });
      expect(within(pipeline).getByText('chat.completion')).not.toBeNull();
      expect(within(pipeline).getByText('tool.search_docs')).not.toBeNull();
      expect(within(pipeline).getByText('workflow.support')).not.toBeNull();
    });

    it('shows the four supported signal dimensions', () => {
      render(<SignalsOverviewPage />);

      const pipeline = screen.getByRole('list', { name: 'Signals analysis pipeline' });
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

    it('previews where grouped trace relationships will appear', () => {
      render(<SignalsOverviewPage />);

      expect(
        screen.getByText(/grouped trace relationships will appear after traces contain at least two signal types/i),
      ).not.toBeNull();
    });

    it('shows that the analysis is waiting for traces', () => {
      render(<SignalsOverviewPage />);

      expect(screen.getByText('Waiting for traces.')).not.toBeNull();
    });

    it('links to the tracing documentation', () => {
      render(<SignalsOverviewPage />);

      expect(screen.getByRole('link', { name: 'Read the docs' }).getAttribute('href')).toBe(
        'https://mastra.ai/en/docs/observability/tracing/overview',
      );
    });

    it('links to incoming traces', () => {
      render(<SignalsOverviewPage />);

      expect(screen.getByRole('link', { name: 'View incoming traces' }).getAttribute('href')).toBe('/observability');
    });
  });
});

describe('SignalsEmptyState', () => {
  describe('when a custom action is supplied', () => {
    it('renders the custom action', () => {
      render(<SignalsEmptyState actionSlot={<button type="button">Choose an agent</button>} />);

      expect(screen.getByRole('button', { name: 'Choose an agent' })).not.toBeNull();
    });
  });
});
