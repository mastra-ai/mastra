import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../e2e/ui/render';
import { AlertActivity } from './AlertActivity';

describe('AlertActivity', () => {
  it('summarizes the alert and lists its timeline, flapping with its count', () => {
    renderWithProviders(
      <AlertActivity
        item={{
          metadata: {
            alert: { fireCount: 12, severity: 'error', incidents: { 'inc-1': {}, 'inc-2': {} } },
            alertTimeline: [
              { at: '2026-11-13T10:00:00.000Z', kind: 'fired', text: 'Weather agent error rate fired (error).' },
              { at: '2026-11-13T10:05:00.000Z', kind: 'recovered', text: 'Recovered.' },
              { at: '2026-11-13T10:10:00.000Z', kind: 'flapping', text: 'Fired and recovered repeatedly.', count: 10 },
              { at: 'not a date', kind: 42, text: 'dropped' },
            ],
          },
        }}
      />,
    );

    const section = screen.getByRole('region', { name: 'Alert activity' });
    for (const part of ['Fired 12 times', '2 incidents', 'highest severity error']) {
      expect(within(section).getByText(part)).toBeInTheDocument();
    }
    const rows = within(section).getAllByRole('listitem');
    expect(rows.map(row => row.textContent?.split('.')[0])).toEqual([
      expect.stringContaining('FiredWeather agent error rate fired (error)'),
      expect.stringContaining('RecoveredRecovered'),
      expect.stringContaining('Flapping ×10Fired and recovered repeatedly'),
    ]);
    expect(within(section).queryByText('dropped')).not.toBeInTheDocument();
  });

  it('renders nothing on a card the alerts source never wrote to', () => {
    const { container } = renderWithProviders(<AlertActivity item={{ metadata: { labels: ['bug'] } }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
