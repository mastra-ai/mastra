// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RotatingText } from './rotating-text';

const messages = ['Calling your target…', 'Working through the items…', 'Tallying the results…'];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('RotatingText', () => {
  it('starts on the first message', () => {
    render(<RotatingText messages={messages} />);

    expect(screen.getByText('Calling your target…')).toBeTruthy();
  });

  it('moves to the next message after each interval', () => {
    render(<RotatingText messages={messages} intervalMs={1000} />);

    advance(1000);
    expect(screen.queryByText('Calling your target…')).toBeNull();
    expect(screen.getByText('Working through the items…')).toBeTruthy();

    advance(1000);
    expect(screen.getByText('Tallying the results…')).toBeTruthy();
  });

  it('wraps back to the first message after the last one', () => {
    render(<RotatingText messages={messages} intervalMs={1000} />);

    advance(3000);

    expect(screen.getByText('Calling your target…')).toBeTruthy();
  });

  it('adds no markup of its own', () => {
    const { container } = render(<RotatingText messages={messages} />);

    expect(container.innerHTML).toBe('Calling your target…');
  });

  it('renders nothing when there are no messages', () => {
    const { container } = render(<RotatingText messages={[]} />);

    expect(container.innerHTML).toBe('');
  });
});
