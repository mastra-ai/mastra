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
});
