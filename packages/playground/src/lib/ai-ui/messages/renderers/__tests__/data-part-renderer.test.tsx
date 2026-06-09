// @vitest-environment jsdom
import type { DataPart } from '@mastra/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataPartRenderer } from '../data-part-renderer';

describe('DataPartRenderer', () => {
  it('renders a SignalBadge for a valid data-signal part', () => {
    const part = {
      type: 'data-signal',
      data: { type: 'state', contents: 'signal body', metadata: { state: { id: 'cart' } } },
    } as unknown as DataPart;

    render(<DataPartRenderer part={part} />);

    expect(screen.getByText('cart')).toBeTruthy();
  });

  it('renders nothing for a non-signal data part', () => {
    const part = { type: 'data-other', data: { foo: 'bar' } } as unknown as DataPart;

    const { container } = render(<DataPartRenderer part={part} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the signal data is not a recognized signal shape', () => {
    const part = { type: 'data-signal', data: { type: 'unknown' } } as unknown as DataPart;

    const { container } = render(<DataPartRenderer part={part} />);

    expect(container.firstChild).toBeNull();
  });
});
