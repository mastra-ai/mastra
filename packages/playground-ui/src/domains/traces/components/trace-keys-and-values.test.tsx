// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TraceKeysAndValues } from './trace-keys-and-values';

afterEach(cleanup);

describe('TraceKeysAndValues', () => {
  it('uses readable entity and status labels', () => {
    render(
      <TraceKeysAndValues
        rootSpan={{
          entityId: 'mastra-docs-agent',
          entityName: 'Mastra Docs Agent',
          entityType: 'workflow_run',
          startedAt: new Date(2026, 5, 1, 17, 9, 59, 665),
          endedAt: new Date(2026, 5, 1, 17, 10, 45, 966),
        }}
      />,
    );

    expect(screen.getByText('Entity')).not.toBeNull();
    expect(screen.queryByText('Entity Id')).toBeNull();
    expect(screen.getByText('Mastra Docs Agent')).not.toBeNull();
    expect(screen.getByText('Workflow Run')).not.toBeNull();
    expect(screen.getByText('Success')).not.toBeNull();
  });

  it('shows a rounded duration with the precise duration on hover', async () => {
    render(
      <TraceKeysAndValues
        rootSpan={{
          startedAt: new Date(2026, 5, 1, 17, 9, 59, 665),
          endedAt: new Date(2026, 5, 1, 17, 10, 45, 966),
        }}
      />,
    );

    const duration = screen.getByText('46.3s');
    fireEvent.focus(duration);

    expect((await screen.findByRole('tooltip')).textContent).toBe('46.301s');
  });

  it('shows compact 12-hour timestamps with full precision on hover', async () => {
    render(
      <TraceKeysAndValues
        rootSpan={{
          startedAt: new Date(2026, 5, 1, 17, 9, 59, 665),
          endedAt: new Date(2026, 5, 1, 17, 10, 45, 966),
        }}
      />,
    );

    const startedAt = screen.getByText('5:09:59 PM');
    expect(screen.getByText('5:10:45 PM')).not.toBeNull();

    fireEvent.focus(startedAt);
    expect((await screen.findByRole('tooltip')).textContent).toBe('Jun 1, 2026, 5:09:59.665 PM');
  });

  it('uses container breakpoints for responsive columns', () => {
    const { container } = render(
      <TraceKeysAndValues
        numOfCol={3}
        rootSpan={{
          startedAt: new Date(2026, 5, 1, 17, 9, 59, 665),
          endedAt: new Date(2026, 5, 1, 17, 10, 45, 966),
        }}
      />,
    );

    expect(container.firstElementChild?.classList.contains('@container')).toBe(true);
    const grid = container.querySelector('dl');
    expect(grid?.className).toContain('grid-cols-[auto_1fr]!');
    expect(grid?.className).toContain('@md:grid-cols-[auto_auto_auto_1fr]!');
    expect(grid?.className).toContain('@xl:grid-cols-[auto_auto_auto_auto_auto_1fr]!');
  });
});
