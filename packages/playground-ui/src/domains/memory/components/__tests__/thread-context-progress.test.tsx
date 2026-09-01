// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ThreadContextProgress } from '../thread-context-progress';

afterEach(() => {
  cleanup();
});

const barFill = (label: string) => {
  const heading = screen.getByText(label);
  return heading.closest('div.min-w-0')?.querySelector<HTMLElement>('div.h-full');
};

describe('ThreadContextProgress', () => {
  it('drops a budget with no threshold instead of drawing it full', () => {
    render(
      <ThreadContextProgress messageTokens={0} messageThreshold={0} memoryTokens={5_000} memoryThreshold={8_000} />,
    );

    expect(screen.queryByText('Messages')).toBeNull();
    expect(screen.getByText('Memory')).toBeTruthy();
  });

  it('renders nothing when neither budget can be drawn', () => {
    const { container } = render(<ThreadContextProgress />);

    expect(container.innerHTML).toBe('');
  });

  it.each([
    ['a missing token count', { messageThreshold: 8_000 }],
    ['a missing threshold', { messageTokens: 100 }],
    ['a negative threshold', { messageTokens: 100, messageThreshold: -1 }],
  ])('drops the messages bar for %s', (_, props) => {
    render(<ThreadContextProgress {...props} />);

    expect(screen.queryByText('Messages')).toBeNull();
  });

  it('draws both bars when both budgets are known', () => {
    render(
      <ThreadContextProgress
        messageTokens={2_000}
        messageThreshold={8_000}
        memoryTokens={4_000}
        memoryThreshold={8_000}
      />,
    );

    expect(barFill('Messages')?.style.width).toBe('25%');
    expect(barFill('Memory')?.style.width).toBe('50%');
  });

  it('keeps a bar between empty and full', () => {
    render(<ThreadContextProgress messageTokens={0} messageThreshold={8_000} />);
    expect(barFill('Messages')?.style.width).toBe('0%');
    cleanup();

    // Over budget still reads as full, never past the track.
    render(<ThreadContextProgress messageTokens={12_000} messageThreshold={8_000} />);
    expect(barFill('Messages')?.style.width).toBe('100%');
    cleanup();

    // A negative count cannot pull the bar below empty either.
    render(<ThreadContextProgress messageTokens={-500} messageThreshold={8_000} />);
    expect(barFill('Messages')?.style.width).toBe('0%');
  });

  it('shows the count against its budget', () => {
    render(<ThreadContextProgress messageTokens={2_500} messageThreshold={8_000} />);

    expect(screen.getByText('2.5/8k')).toBeTruthy();
  });

  it('lets the caller rename the memory bar', () => {
    render(<ThreadContextProgress memoryTokens={1_000} memoryThreshold={8_000} memoryLabel="Working memory" />);

    expect(screen.getByText('Working memory')).toBeTruthy();
    expect(screen.queryByText('Memory')).toBeNull();
  });
});
