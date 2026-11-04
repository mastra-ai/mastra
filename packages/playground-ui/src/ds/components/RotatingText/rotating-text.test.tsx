// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RotatingText } from './rotating-text';

const messages = ['Calling your target…', 'Working through the items…', 'Tallying the results…'];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('RotatingText', () => {
  it('starts on a random message', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    const { container } = render(<RotatingText messages={messages} />);

    expect(container.textContent).toBe('Tallying the results…');
  });

  it('switches to another message after each interval, never repeating the one shown', () => {
    const { container } = render(<RotatingText messages={messages} intervalMs={1000} />);

    for (let tick = 0; tick < 20; tick++) {
      const before = container.textContent;
      advance(1000);
      expect(messages).toContain(container.textContent);
      expect(container.textContent).not.toBe(before);
    }
  });

  it('adds no markup of its own', () => {
    const { container } = render(<RotatingText messages={messages} />);

    expect(messages).toContain(container.innerHTML);
  });

  it('keeps a single message in place', () => {
    const { container } = render(<RotatingText messages={['Waiting to start…']} intervalMs={1000} />);

    advance(5000);

    expect(container.textContent).toBe('Waiting to start…');
  });

  it('renders nothing when there are no messages', () => {
    const { container } = render(<RotatingText messages={[]} />);

    expect(container.innerHTML).toBe('');
  });
});
