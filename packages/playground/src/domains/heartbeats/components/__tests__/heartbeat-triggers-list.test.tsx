// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeHeartbeatTrigger } from '../../__tests__/fixtures/heartbeats';
import { HeartbeatTriggersList } from '../heartbeat-triggers-list';

describe('HeartbeatTriggersList', () => {
  it('renders an empty state when there are no triggers', () => {
    render(<HeartbeatTriggersList triggers={[]} isLoading={false} />);
    expect(screen.getByText('No trigger history yet.')).not.toBeNull();
  });

  it('does not render the runId — replaces it with the fire timestamp', () => {
    const fired = new Date('2026-05-28T12:00:00Z').getTime();
    const trigger = makeHeartbeatTrigger({
      id: 'trg_1',
      runId: 'sched_hb_chef_thread-1_should-not-show',
      actualFireAt: fired,
      scheduledFireAt: fired,
    });

    const { container } = render(<HeartbeatTriggersList triggers={[trigger]} isLoading={false} />);

    // The long, ugly runId must not appear in the heartbeat triggers list.
    expect(container.textContent).not.toContain('sched_hb_chef_thread-1_should-not-show');
    expect(container.textContent).not.toContain('Run ID');
  });

  it('renders the Fired at, Status, Started, Duration headers', () => {
    const trigger = makeHeartbeatTrigger();
    const { container } = render(<HeartbeatTriggersList triggers={[trigger]} isLoading={false} />);

    const text = container.textContent ?? '';
    expect(text).toContain('Fired at');
    expect(text).toContain('Status');
    expect(text).toContain('Started');
    expect(text).toContain('Duration');
  });
});
