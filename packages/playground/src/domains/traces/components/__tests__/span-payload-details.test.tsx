import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { TimelineSpan } from '../../lib/build-thread-timeline';
import { SpanPayloadDetails } from '../span-payload-details';

function renderDetails(span: Partial<TimelineSpan>) {
  return render(<SpanPayloadDetails span={{ spanId: 'a', ...span }} />);
}

describe('SpanPayloadDetails', () => {
  it('renders nothing when the span carries no payload', () => {
    const { container } = renderDetails({ attributes: { model: 'gpt-4o' } });

    expect(container.firstChild).toBeNull();
  });

  it('keeps the payload behind a collapsed trigger', () => {
    renderDetails({ input: { city: 'Paris' } });

    expect(screen.getByTestId('span-payload-details')).toBeTruthy();
    expect(screen.queryByText(/Paris/)).toBeNull();
  });

  it('reveals the labelled payloads once expanded', () => {
    renderDetails({ input: { city: 'Paris' }, output: { temp: 21 } });

    fireEvent.click(screen.getByTestId('span-payload-details'));

    expect(screen.getByText('Input')).toBeTruthy();
    expect(screen.getByText('Output')).toBeTruthy();
    expect(screen.getByText(/Paris/)).toBeTruthy();
    expect(screen.getByText(/21/)).toBeTruthy();
  });
});
