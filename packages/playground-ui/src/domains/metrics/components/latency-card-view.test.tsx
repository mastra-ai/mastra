// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { LatencyPoint } from '../hooks/use-latency-metrics';
import { LatencyCardView } from './latency-card-view';

const agentPoint: LatencyPoint = {
  time: '15:00',
  tsMs: new Date('2026-07-02T15:00:00.000Z').getTime(),
  p50: 7470,
  p95: 7470,
};

afterEach(() => {
  cleanup();
});

describe('LatencyCardView', () => {
  describe('when only one entity type has latency data', () => {
    it('marks empty entity tabs as disabled instead of leaving them as silent no-ops', () => {
      render(
        <LatencyCardView
          data={{ agentData: [agentPoint], workflowData: [], toolData: [] }}
          isLoading={false}
          isError={false}
        />,
      );

      const agentsTab = screen.getByRole('tab', { name: 'Agents' });
      const workflowsTab = screen.getByRole('tab', { name: 'Workflows' });
      const toolsTab = screen.getByRole('tab', { name: 'Tools' });

      expect(agentsTab.getAttribute('aria-selected')).toBe('true');
      expect(workflowsTab.getAttribute('aria-disabled')).toBe('true');
      expect(toolsTab.getAttribute('aria-disabled')).toBe('true');

      fireEvent.click(workflowsTab);

      expect(agentsTab.getAttribute('aria-selected')).toBe('true');
      expect(screen.queryByText('No latency data yet')).toBeNull();
    });
  });

  describe('while the data is still coming', () => {
    it('shows a spinner and nothing to read yet', () => {
      const { container } = render(<LatencyCardView data={undefined} isLoading isError={false} />);

      expect(container.querySelector('svg')).toBeTruthy();
      expect(screen.queryByRole('tab')).toBeNull();
      expect(screen.queryByText('No latency data yet')).toBeNull();
    });

    it('says so when the request failed', () => {
      render(<LatencyCardView data={undefined} isLoading={false} isError />);

      expect(screen.getByText('Failed to load latency data')).toBeTruthy();
      expect(screen.queryByRole('tab')).toBeNull();
    });

    it('prefers the spinner over the error while both are set', () => {
      render(<LatencyCardView data={undefined} isLoading isError />);

      expect(screen.queryByText('Failed to load latency data')).toBeNull();
    });
  });

  describe('with nothing to chart', () => {
    it('says there is no data when the query returned nothing', () => {
      render(<LatencyCardView data={undefined} isLoading={false} isError={false} />);

      expect(screen.getByText('No latency data yet')).toBeTruthy();
      expect(screen.queryByRole('tab')).toBeNull();
    });

    it('says there is no data when every entity type came back empty', () => {
      render(
        <LatencyCardView data={{ agentData: [], workflowData: [], toolData: [] }} isLoading={false} isError={false} />,
      );

      expect(screen.getByText('No latency data yet')).toBeTruthy();
      expect(screen.queryByRole('tab')).toBeNull();
    });

    it('leaves out the headline number entirely', () => {
      render(<LatencyCardView data={undefined} isLoading={false} isError={false} />);

      expect(screen.queryByText('Avg p50')).toBeNull();
    });
  });

  describe('the headline number', () => {
    it('averages p50 across every entity type, not just the visible tab', () => {
      render(
        <LatencyCardView
          data={{
            agentData: [{ ...agentPoint, p50: 100 }],
            workflowData: [{ ...agentPoint, p50: 200 }],
            toolData: [{ ...agentPoint, p50: 300 }],
          }}
          isLoading={false}
          isError={false}
        />,
      );

      expect(screen.getByText('200ms')).toBeTruthy();
      expect(screen.getByText('Avg p50')).toBeTruthy();
    });

    it('rounds to whole milliseconds', () => {
      render(
        <LatencyCardView
          data={{
            agentData: [
              { ...agentPoint, p50: 100 },
              { ...agentPoint, p50: 101 },
            ],
            workflowData: [],
            toolData: [],
          }}
          isLoading={false}
          isError={false}
        />,
      );

      expect(screen.getByText('101ms')).toBeTruthy();
    });

    it('falls back to a dash when the points carry no p50 at all', () => {
      render(
        <LatencyCardView
          data={{
            agentData: [{ time: '15:00', tsMs: agentPoint.tsMs, p95: 500 } as LatencyPoint],
            workflowData: [],
            toolData: [],
          }}
          isLoading={false}
          isError={false}
        />,
      );

      expect(screen.getByText('—')).toBeTruthy();
    });
  });

  describe('the entity tabs', () => {
    it('opens on the first entity type that has data', () => {
      render(
        <LatencyCardView
          data={{ agentData: [], workflowData: [agentPoint], toolData: [agentPoint] }}
          isLoading={false}
          isError={false}
        />,
      );

      expect(screen.getByRole('tab', { name: 'Workflows' }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('tab', { name: 'Agents' }).getAttribute('aria-disabled')).toBe('true');
    });

    it('charts a period where only workflows ran', () => {
      render(
        <LatencyCardView
          data={{ agentData: [], workflowData: [agentPoint], toolData: [] }}
          isLoading={false}
          isError={false}
        />,
      );

      expect(screen.queryByText('No latency data yet')).toBeNull();
      expect(screen.getByRole('tab', { name: 'Workflows' }).getAttribute('aria-selected')).toBe('true');
    });

    it('falls through to tools when neither agents nor workflows have any', () => {
      render(
        <LatencyCardView
          data={{ agentData: [], workflowData: [], toolData: [agentPoint] }}
          isLoading={false}
          isError={false}
        />,
      );

      expect(screen.getByRole('tab', { name: 'Tools' }).getAttribute('aria-selected')).toBe('true');
    });

    it('follows a click onto a tab that does have data', () => {
      render(
        <LatencyCardView
          data={{ agentData: [agentPoint], workflowData: [agentPoint], toolData: [] }}
          isLoading={false}
          isError={false}
        />,
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Workflows' }));

      expect(screen.getByRole('tab', { name: 'Workflows' }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('tab', { name: 'Agents' }).getAttribute('aria-selected')).toBe('false');
    });

    it('moves off a tab whose data disappeared under it', () => {
      const { rerender } = render(
        <LatencyCardView
          data={{ agentData: [agentPoint], workflowData: [agentPoint], toolData: [] }}
          isLoading={false}
          isError={false}
        />,
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Workflows' }));
      expect(screen.getByRole('tab', { name: 'Workflows' }).getAttribute('aria-selected')).toBe('true');

      rerender(
        <LatencyCardView
          data={{ agentData: [agentPoint], workflowData: [], toolData: [agentPoint] }}
          isLoading={false}
          isError={false}
        />,
      );

      // Workflows is empty now, so the card goes back to the FIRST tab that
      // still has data — agents — not simply the next one that does.
      expect(screen.getByRole('tab', { name: 'Agents' }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('tab', { name: 'Tools' }).getAttribute('aria-selected')).toBe('false');
    });

    it('does not remember a click on a tab that had nothing to show', () => {
      const { rerender } = render(
        <LatencyCardView
          data={{ agentData: [agentPoint], workflowData: [], toolData: [] }}
          isLoading={false}
          isError={false}
        />,
      );

      fireEvent.click(screen.getByRole('tab', { name: 'Workflows' }));

      rerender(
        <LatencyCardView
          data={{ agentData: [agentPoint], workflowData: [agentPoint], toolData: [] }}
          isLoading={false}
          isError={false}
        />,
      );

      // Workflows has data now, but the earlier dead click must not resurface
      // as a selection the user never made.
      expect(screen.getByRole('tab', { name: 'Agents' }).getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('the chart legend', () => {
    it('averages p50 and p95 over the visible tab', () => {
      render(
        <LatencyCardView
          data={{
            agentData: [
              { ...agentPoint, p50: 100, p95: 900 },
              { ...agentPoint, p50: 300, p95: 1100 },
            ],
            workflowData: [],
            toolData: [],
          }}
          isLoading={false}
          isError={false}
        />,
      );

      expect(screen.getByText('p50')).toBeTruthy();
      expect(screen.getByText('p95')).toBeTruthy();
      expect(screen.getByText('200')).toBeTruthy();
      expect(screen.getByText('1000')).toBeTruthy();
      expect(screen.getAllByText('avg ms')).toHaveLength(2);
    });
  });

  describe('the action slot', () => {
    it('renders a plain node as given', () => {
      render(
        <LatencyCardView
          data={{ agentData: [agentPoint], workflowData: [], toolData: [] }}
          isLoading={false}
          isError={false}
          actions={<button type="button">View in Traces</button>}
        />,
      );

      expect(screen.getByRole('button', { name: 'View in Traces' })).toBeTruthy();
    });

    it('hands a render function the tab that is actually showing', () => {
      render(
        <LatencyCardView
          data={{ agentData: [agentPoint], workflowData: [agentPoint], toolData: [] }}
          isLoading={false}
          isError={false}
          actions={tab => <button type="button">View {tab}</button>}
        />,
      );

      expect(screen.getByRole('button', { name: 'View agents' })).toBeTruthy();

      fireEvent.click(screen.getByRole('tab', { name: 'Workflows' }));

      expect(screen.getByRole('button', { name: 'View workflows' })).toBeTruthy();
    });

    it('leaves out the action bar when the slot renders nothing', () => {
      const topBarOf = (root: HTMLElement) => {
        const bar = screen.getByText('Latency').closest('div')?.parentElement;
        expect(root.contains(bar ?? null)).toBe(true);
        return bar;
      };

      const withAction = render(
        <LatencyCardView
          data={{ agentData: [agentPoint], workflowData: [], toolData: [] }}
          isLoading={false}
          isError={false}
          actions={<button type="button">View in Traces</button>}
        />,
      );
      const withCount = topBarOf(withAction.container)?.childElementCount;

      cleanup();

      const withoutAction = render(
        <LatencyCardView
          data={{ agentData: [agentPoint], workflowData: [], toolData: [] }}
          isLoading={false}
          isError={false}
          actions={() => null}
        />,
      );

      // No empty container left behind to take up gap in the top bar.
      expect(topBarOf(withoutAction.container)?.childElementCount).toBe((withCount ?? 0) - 1);
    });
  });
});
