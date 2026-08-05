import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReasoningStreamingLine } from '../reasoning-streaming-line';

describe('ReasoningStreamingLine', () => {
  it('renders the label inside a Shimmer', () => {
    render(<ReasoningStreamingLine text="Reasoning..." />);

    const label = screen.getByText('Reasoning...');
    expect(label).not.toBeNull();
    // The shared Shimmer leaf drives the shimmer-text animation.
    expect(label.style.animation).toContain('shimmer-text');
  });

  it('renders a spinner alongside the shimmer label', () => {
    const { container } = render(<ReasoningStreamingLine text="Thinking" />);

    expect(container.querySelector('svg')).not.toBeNull();
  });
});
