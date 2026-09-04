// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, assert, describe, expect, it } from 'vitest';
import { TraceSummaryDescription } from '../trace-summary-description';

afterEach(cleanup);

const rootSpan = {
  entityId: 'weather-agent',
  entityName: 'Weather Agent',
  entityType: 'agent',
  startedAt: new Date(2026, 5, 1, 17, 9, 59, 665),
  endedAt: new Date(2026, 5, 1, 17, 10, 45, 966),
};

describe('TraceSummaryDescription', () => {
  it('shows the start time with full precision on hover and the duration next to it', async () => {
    render(<TraceSummaryDescription rootSpan={rootSpan} />);

    const startedAt = screen.getByText('5:09:59 PM');
    expect(screen.getByText('46.3s')).not.toBeNull();

    fireEvent.focus(startedAt);
    expect((await screen.findByRole('tooltip')).textContent).toBe('Started at Jun 1, 2026, 5:09:59.665 PM');
  });

  it('shows the readable entity type in a tooltip', async () => {
    render(<TraceSummaryDescription rootSpan={rootSpan} />);

    const entity = screen.getByText('Weather Agent').closest('[tabindex]');
    assert(entity);
    fireEvent.focus(entity);
    expect((await screen.findByRole('tooltip')).textContent).toBe('Agent');
  });

  it('links the entity name when a href is provided', () => {
    render(
      <TraceSummaryDescription
        rootSpan={rootSpan}
        entityHref="/agents/weather-agent/chat/new"
        LinkComponent={props => <a {...props} />}
      />,
    );

    const link = screen.getByRole('link', { name: /Weather Agent/ });
    expect(link.getAttribute('href')).toBe('/agents/weather-agent/chat/new');
  });

  it('renders the entity name as plain text without a href', () => {
    render(<TraceSummaryDescription rootSpan={rootSpan} />);

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('falls back to the entity id when the entity has no name', () => {
    render(<TraceSummaryDescription rootSpan={{ ...rootSpan, entityName: '' }} />);

    expect(screen.getByText('weather-agent')).not.toBeNull();
  });

  it('titles multi-word entity types in the tooltip', async () => {
    render(<TraceSummaryDescription rootSpan={{ ...rootSpan, entityType: 'workflow_run' }} />);

    const entity = screen.getByText('Weather Agent').closest('[tabindex]');
    assert(entity);
    fireEvent.focus(entity);
    expect((await screen.findByRole('tooltip')).textContent).toBe('Workflow Run');
  });

  it('shows input tokens, output tokens, and estimated cost inline with tooltip labels', async () => {
    render(
      <TraceSummaryDescription
        rootSpan={rootSpan}
        usage={{ inputTokens: 1200, outputTokens: 345, estimatedCost: 0.001, costUnit: 'usd' }}
      />,
    );

    expect(screen.getByText('1.2K')).not.toBeNull();
    expect(screen.getByText('345')).not.toBeNull();
    expect(screen.getByText('$0.0010')).not.toBeNull();

    fireEvent.focus(screen.getByLabelText('Input tokens'));
    expect((await screen.findByRole('tooltip')).textContent).toBe('Input tokens');
  });

  it('leaves out the entity block when the span never carried one', () => {
    render(<TraceSummaryDescription rootSpan={{ startedAt: rootSpan.startedAt, endedAt: rootSpan.endedAt }} />);

    expect(screen.queryByText('Agent')).toBeNull();
    expect(screen.getByText('5:09:59 PM')).not.toBeNull();
  });

  it('shows no duration while the trace is still running', () => {
    render(<TraceSummaryDescription rootSpan={{ ...rootSpan, endedAt: null }} />);

    expect(screen.queryByText('46.3s')).toBeNull();
    expect(screen.getByText('5:09:59 PM')).not.toBeNull();
  });
});
