// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SignalsEmptyState } from '../signals-empty-state';
import { SignalsOverviewPage } from '../signals-overview-page';

afterEach(() => cleanup());

describe('SignalsOverviewPage', () => {
  describe('when Trace Intelligence has not launched yet', () => {
    it('explains the purpose of Trace Intelligence', () => {
      render(<SignalsOverviewPage />);

      expect(screen.getByRole('heading', { name: 'Understand what drives every agent interaction' })).not.toBeNull();
    });

    it('shows the ordered trace analysis pipeline', () => {
      render(<SignalsOverviewPage />);

      const pipeline = screen.getByRole('list', { name: 'Trace Intelligence analysis pipeline' });
      const stageHeadings = within(pipeline)
        .getAllByRole('heading')
        .map(heading => heading.textContent);

      expect(stageHeadings).toEqual(['Traces', 'Trace Intelligence', 'Theme analysis']);
    });

    it('shows representative trace inputs', () => {
      render(<SignalsOverviewPage />);

      const pipeline = screen.getByRole('list', { name: 'Trace Intelligence analysis pipeline' });
      expect(within(pipeline).getByText('chat.completion')).not.toBeNull();
      expect(within(pipeline).getByText('tool.search_docs')).not.toBeNull();
      expect(within(pipeline).getByText('workflow.support')).not.toBeNull();
    });

    it('shows the four supported trace signal dimensions', () => {
      render(<SignalsOverviewPage />);

      const pipeline = screen.getByRole('list', { name: 'Trace Intelligence analysis pipeline' });
      for (const signal of ['Outcome', 'Goal', 'Behavior', 'Sentiment']) {
        expect(within(pipeline).getByText(signal)).not.toBeNull();
      }
    });

    it('defines each supported trace signal in plain language', () => {
      render(<SignalsOverviewPage />);

      const definitions = screen.getByRole('list', { name: 'Trace signal definitions' });
      expect(within(definitions).getByText(/what the user wanted from the interaction/i)).not.toBeNull();
      expect(within(definitions).getByText(/how the interaction ended/i)).not.toBeNull();
      expect(within(definitions).getByText(/what the agent did in response/i)).not.toBeNull();
      expect(within(definitions).getByText(/the tone the user expressed during the interaction/i)).not.toBeNull();
    });

    it('shows that Trace Intelligence is collecting traces', () => {
      render(<SignalsOverviewPage />);

      expect(screen.getByText('Collecting traces for Trace Intelligence.')).not.toBeNull();
    });

    it('links to the Trace Intelligence documentation', () => {
      render(<SignalsOverviewPage />);

      expect(screen.getByRole('link', { name: /Read the docs/ }).getAttribute('href')).toBe(
        'https://mastra.ai/en/docs/mastra-platform/trace-intelligence',
      );
    });

    it('links to incoming traces', () => {
      render(<SignalsOverviewPage />);

      expect(screen.getByRole('link', { name: 'View incoming traces' }).getAttribute('href')).toBe('/traces');
    });
  });
});

describe('SignalsEmptyState', () => {
  describe('when progress is available', () => {
    it('shows trace and trace signal processing progress', () => {
      render(
        <SignalsEmptyState
          progress={{
            status: 'processing',
            traceCount: 87,
            signals: {
              goal: { generated: 87, embedded: 84 },
              outcome: { generated: 87, embedded: 40 },
              behavior: { generated: 52, embedded: 12 },
              sentiment: { generated: 0, embedded: 0 },
            },
            availableSignals: ['goal'],
          }}
        />,
      );

      expect(screen.getByText('Analyzing traces for Trace Intelligence.')).not.toBeNull();
      expect(screen.getByText('87')).not.toBeNull();
      expect(screen.getByText('1 of 4')).not.toBeNull();
      expect(screen.getByText('87 generated · 84 embedded')).not.toBeNull();
    });
  });

  describe('when a custom action is supplied', () => {
    it('renders the custom action', () => {
      render(<SignalsEmptyState actionSlot={<button type="button">Choose an agent</button>} />);

      expect(screen.getByRole('button', { name: 'Choose an agent' })).not.toBeNull();
    });
  });
});
