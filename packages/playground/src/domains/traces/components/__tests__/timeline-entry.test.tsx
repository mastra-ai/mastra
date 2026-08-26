// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TimelineEntry } from '../timeline-entry';

afterEach(() => cleanup());

describe('TimelineEntry', () => {
  it('shows duration, tokens, cost and the humanized name in the meta line', () => {
    render(
      <TimelineEntry
        span={{
          spanId: 'a',
          spanType: 'model_generation',
          name: "llm: 'gpt-4o'",
          attributes: {
            model: 'gpt-4o',
            usage: { inputTokens: 120, outputTokens: 30 },
            costContext: { estimatedCost: 0.0042, costUnit: 'USD' },
          },
          startedAt: '2026-01-01T10:00:00.000Z',
          endedAt: '2026-01-01T10:00:01.500Z',
        }}
      />,
    );

    const meta = screen.getByText(/tokens/);
    expect(meta.textContent).toContain('1.5 s');
    expect(meta.textContent).toContain('120 ↑ / 30 ↓ tokens');
    expect(meta.textContent).toContain('0.0042 USD');
    // the humanized name already appears in the prose above: never repeat it in the meta line
    expect(meta.textContent).not.toContain('Generated with model');
    expect(meta.textContent).not.toContain("llm: 'gpt-4o'");
  });

  it('keeps the wall clock and the humanized name reachable on hover', () => {
    render(
      <TimelineEntry
        span={{
          spanId: 'a',
          spanType: 'processor_run',
          name: 'input processor: moderation',
          entityId: 'moderation',
          startedAt: '2026-01-01T10:00:00.000Z',
        }}
      />,
    );

    const clock = new Date('2026-01-01T10:00:00.000Z').toLocaleTimeString();

    // Decision 6: both are visible, not hover-only.
    const details = screen.getByTestId('timeline-entry-details').textContent ?? '';
    expect(details).toContain('Ran processor moderation');
    expect(details).toContain(clock);

    // ...and duplicated as hover text for truncated rows.
    const title = screen.getByTestId('timeline-entry').getAttribute('title') ?? '';
    expect(title).toContain('Ran processor moderation');
    expect(title).toContain(clock);
  });

  it('marks failed spans and shows their message', () => {
    render(
      <TimelineEntry
        span={{ spanId: 'b', spanType: 'tool_call', entityId: 'weatherInfo', error: { message: 'API down' } }}
      />,
    );

    expect(screen.getByTestId('timeline-entry').getAttribute('data-error')).toBe('true');
    expect(screen.getByTestId('timeline-entry-error').textContent).toBe('API down');
  });

  it('renders successful spans without an error block', () => {
    render(<TimelineEntry span={{ spanId: 'c', spanType: 'tool_call', entityId: 'weatherInfo' }} />);

    expect(screen.getByTestId('timeline-entry').getAttribute('data-error')).toBeNull();
    expect(screen.queryByTestId('timeline-entry-error')).toBeNull();
  });
});
