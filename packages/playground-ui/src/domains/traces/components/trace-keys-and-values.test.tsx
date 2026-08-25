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

  it('falls back to the entity id when the entity has no name', () => {
    render(
      <TraceKeysAndValues
        rootSpan={{ entityId: 'mastra-docs-agent', entityName: '', startedAt: new Date(2026, 5, 1, 17, 9, 59) }}
      />,
    );

    expect(screen.getByText('mastra-docs-agent')).not.toBeNull();
  });

  it('leaves out the entity rows the span never carried', () => {
    render(<TraceKeysAndValues rootSpan={{ startedAt: new Date(2026, 5, 1, 17, 9, 59) }} />);

    expect(screen.queryByText('Entity')).toBeNull();
    expect(screen.queryByText('Entity Type')).toBeNull();
    // Status is not optional — every trace has one.
    expect(screen.getByText('Status')).not.toBeNull();
  });

  it('titles every word of a multi-word entity type', () => {
    render(
      <TraceKeysAndValues rootSpan={{ entityType: 'model_generation_run', startedAt: new Date(2026, 5, 1, 17, 9) }} />,
    );

    expect(screen.getByText('Model Generation Run')).not.toBeNull();
  });

  it('calls a trace still running when it has no end', () => {
    render(<TraceKeysAndValues rootSpan={{ startedAt: new Date(2026, 5, 1, 17, 9, 59), endedAt: null }} />);

    expect(screen.getByText('Running')).not.toBeNull();
    // Nothing to say about a duration or an end that has not happened.
    expect(screen.queryByText('Duration')).toBeNull();
    expect(screen.queryByText('Ended at')).toBeNull();
  });

  it('calls a trace failed even when it did finish', () => {
    render(
      <TraceKeysAndValues
        rootSpan={{
          startedAt: new Date(2026, 5, 1, 17, 9, 59),
          endedAt: new Date(2026, 5, 1, 17, 10, 45),
          error: { message: 'boom' },
        }}
      />,
    );

    expect(screen.getByText('Error')).not.toBeNull();
    expect(screen.queryByText('Success')).toBeNull();
  });

  it('leaves out the usage rows entirely when no totals were asked for', () => {
    render(
      <TraceKeysAndValues
        rootSpan={{ startedAt: new Date(2026, 5, 1, 17, 9, 59), endedAt: new Date(2026, 5, 1, 17, 10, 45) }}
      />,
    );

    expect(screen.queryByText('Trace input tokens')).toBeNull();
    expect(screen.queryByText('Trace est. cost')).toBeNull();
  });

  it('shows token totals compactly and the cost in its own currency', () => {
    render(
      <TraceKeysAndValues
        rootSpan={{ startedAt: new Date(2026, 5, 1, 17, 9, 59), endedAt: new Date(2026, 5, 1, 17, 10, 45) }}
        usage={{ inputTokens: 12_400, outputTokens: 800, estimatedCost: 0.0123, costUnit: 'eur' }}
      />,
    );

    expect(screen.getByText('12.4K')).not.toBeNull();
    expect(screen.getByText('800')).not.toBeNull();
    expect(screen.getByText('0.0123 eur')).not.toBeNull();
  });

  it('shows a dash for each total the metrics store could not produce', () => {
    render(
      <TraceKeysAndValues
        rootSpan={{ startedAt: new Date(2026, 5, 1, 17, 9, 59), endedAt: new Date(2026, 5, 1, 17, 10, 45) }}
        usage={{ inputTokens: undefined, outputTokens: 0, estimatedCost: undefined, costUnit: undefined }}
      />,
    );

    // A zero is a real total and reads as one; a missing total reads as a dash.
    expect(screen.getAllByText('\u2014')).toHaveLength(2);
    expect(screen.getByText('0')).not.toBeNull();
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

describe('TraceKeysAndValues — column layouts', () => {
  const gridOf = (numOfCol: 1 | 2 | 3) => {
    const { container } = render(
      <TraceKeysAndValues numOfCol={numOfCol} rootSpan={{ startedAt: new Date(2026, 5, 1, 17, 9, 59) }} />,
    );
    return container.querySelector('dl')?.className ?? '';
  };

  it('keeps a single column stacked at every width', () => {
    const grid = gridOf(1);

    expect(grid).toContain('grid-cols-[auto_1fr]!');
    expect(grid).not.toContain('@md:grid-cols-');
  });

  it('opens a second column at the medium container width', () => {
    const grid = gridOf(2);

    expect(grid).toContain('grid-cols-[auto_1fr]!');
    expect(grid).toContain('@md:grid-cols-[auto_auto_auto_1fr]!');
    expect(grid).not.toContain('@xl:grid-cols-');
  });

  it('lays out two columns by default', () => {
    const { container } = render(<TraceKeysAndValues rootSpan={{ startedAt: new Date(2026, 5, 1, 17, 9, 59) }} />);

    expect(container.querySelector('dl')?.className).toContain('@md:grid-cols-[auto_auto_auto_1fr]!');
  });
});

describe('TraceKeysAndValues — timestamps it cannot read', () => {
  it('leaves out the start row when the stamp makes no sense', () => {
    render(<TraceKeysAndValues rootSpan={{ startedAt: 'not a date' }} />);

    expect(screen.queryByText('Started at')).toBeNull();
    expect(screen.getByText('Status')).not.toBeNull();
  });

  it('leaves out the end row when the stamp makes no sense', () => {
    render(<TraceKeysAndValues rootSpan={{ startedAt: new Date(2026, 5, 1, 17, 9, 59), endedAt: 'not a date' }} />);

    expect(screen.queryByText('Ended at')).toBeNull();
    expect(screen.getByText('Started at')).not.toBeNull();
  });
});

describe('TraceKeysAndValues — each total on its own', () => {
  it.each([
    ['input tokens', { inputTokens: undefined, outputTokens: 800, estimatedCost: 0.05, costUnit: 'usd' }],
    ['output tokens', { inputTokens: 12_400, outputTokens: undefined, estimatedCost: 0.05, costUnit: 'usd' }],
    ['the cost', { inputTokens: 12_400, outputTokens: 800, estimatedCost: undefined, costUnit: undefined }],
  ])('dashes only the missing %s', (_, usage) => {
    render(
      <TraceKeysAndValues
        rootSpan={{ startedAt: new Date(2026, 5, 1, 17, 9, 59), endedAt: new Date(2026, 5, 1, 17, 10, 45) }}
        usage={usage}
      />,
    );

    expect(screen.getAllByText('—')).toHaveLength(1);
  });
});
