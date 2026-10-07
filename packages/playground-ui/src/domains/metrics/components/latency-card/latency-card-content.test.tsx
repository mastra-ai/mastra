// @vitest-environment jsdom
import type { LatencyMetricsData, LatencyPoint } from '@mastra/react/hooks/metrics';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { LatencyCardContent } from './latency-card-content';
import { resolveActiveTab } from './latency-card.utils';
import type { LatencyTab } from './latency-card.utils';

const agentPoint: LatencyPoint = {
  time: '15:00',
  tsMs: new Date('2026-07-02T15:00:00.000Z').getTime(),
  p50: 7470,
  p95: 7470,
};

function data(partial: Partial<LatencyMetricsData>): LatencyMetricsData {
  return { agentData: [], workflowData: [], toolData: [], interval: '1h', ...partial };
}

function Host({ value }: { value: LatencyMetricsData }) {
  const [selected, setSelected] = useState<LatencyTab>('agents');
  return <LatencyCardContent data={value} activeTab={resolveActiveTab(value, selected)} onTabChange={setSelected} />;
}

const selected = (name: string) => screen.getByRole('tab', { name }).getAttribute('aria-selected');

afterEach(() => {
  cleanup();
});

describe('LatencyCardContent', () => {
  describe('when only one entity type has latency data', () => {
    it('marks empty entity tabs as disabled', () => {
      render(<Host value={data({ agentData: [agentPoint] })} />);

      expect(selected('Agents')).toBe('true');
      expect(screen.getByRole('tab', { name: 'Workflows' }).getAttribute('aria-disabled')).toBe('true');
      expect(screen.getByRole('tab', { name: 'Tools' }).getAttribute('aria-disabled')).toBe('true');

      fireEvent.click(screen.getByRole('tab', { name: 'Workflows' }));

      expect(selected('Agents')).toBe('true');
    });
  });

  describe('with nothing to chart', () => {
    it('says there is no data when every entity type came back empty', () => {
      render(<Host value={data({})} />);

      expect(screen.getByText('No latency data yet')).toBeTruthy();
      expect(screen.queryByRole('tab')).toBeNull();
    });
  });

  describe('the entity tabs', () => {
    it('opens on the first entity type that has data', () => {
      render(<Host value={data({ workflowData: [agentPoint], toolData: [agentPoint] })} />);

      expect(selected('Workflows')).toBe('true');
    });

    it('falls through to tools when neither agents nor workflows have any', () => {
      render(<Host value={data({ toolData: [agentPoint] })} />);

      expect(selected('Tools')).toBe('true');
    });

    it('follows a click onto a tab that does have data', () => {
      render(<Host value={data({ agentData: [agentPoint], workflowData: [agentPoint] })} />);

      fireEvent.click(screen.getByRole('tab', { name: 'Workflows' }));

      expect(selected('Workflows')).toBe('true');
      expect(selected('Agents')).toBe('false');
    });

    it('moves back to the first tab with data when the selected one empties', () => {
      const { rerender } = render(<Host value={data({ agentData: [agentPoint], workflowData: [agentPoint] })} />);

      fireEvent.click(screen.getByRole('tab', { name: 'Workflows' }));
      rerender(<Host value={data({ agentData: [agentPoint], toolData: [agentPoint] })} />);

      expect(selected('Agents')).toBe('true');
      expect(selected('Tools')).toBe('false');
    });
  });

  describe('the chart legend', () => {
    it('averages p50 and p95 over the visible tab and follows tab changes', () => {
      render(
        <Host
          value={data({
            agentData: [
              { ...agentPoint, p50: 100, p95: 900 },
              { ...agentPoint, p50: 300, p95: 1100 },
            ],
            workflowData: [{ ...agentPoint, p50: 42, p95: 77 }],
          })}
        />,
      );

      expect(screen.getByText('200')).toBeTruthy();
      expect(screen.getByText('1000')).toBeTruthy();
      expect(screen.getAllByText('avg ms')).toHaveLength(2);

      fireEvent.click(screen.getByRole('tab', { name: 'Workflows' }));

      expect(screen.getByText('42')).toBeTruthy();
      expect(screen.getByText('77')).toBeTruthy();
      expect(screen.queryByText('200')).toBeNull();
    });
  });
});
