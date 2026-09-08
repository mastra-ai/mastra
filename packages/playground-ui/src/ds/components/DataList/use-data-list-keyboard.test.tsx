// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDataListKeyboard } from './use-data-list-keyboard';

const Subject = ({ count }: { count: number }) => {
  const { containerRef, getRowProps } = useDataListKeyboard({ count });

  return (
    <div ref={containerRef} data-testid="container">
      {Array.from({ length: count }, (_, index) => (
        <button key={index} data-testid={`row-${index}`} {...getRowProps(index)}>
          Row {index}
        </button>
      ))}
    </div>
  );
};

const row = (i: number) => screen.getByTestId(`row-${i}`);

afterEach(() => cleanup());

describe('useDataListKeyboard', () => {
  it('applies roving tabindex: only the first row is initially tabbable', () => {
    render(<Subject count={3} />);

    expect([row(0).tabIndex, row(1).tabIndex, row(2).tabIndex]).toEqual([0, -1, -1]);
  });

  it('moves focus with ArrowDown/ArrowUp and jumps with Home/End', () => {
    render(<Subject count={3} />);
    row(0).focus();

    fireEvent.keyDown(row(0), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(row(1));

    fireEvent.keyDown(row(1), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(row(0));

    fireEvent.keyDown(row(0), { key: 'End' });
    expect(document.activeElement).toBe(row(2));

    fireEvent.keyDown(row(2), { key: 'Home' });
    expect(document.activeElement).toBe(row(0));
  });

  it('makes a row focused by mouse/tab the active roving row', () => {
    render(<Subject count={3} />);

    fireEvent.focus(row(2));
    expect(row(2).tabIndex).toBe(0);
    expect(row(0).tabIndex).toBe(-1);

    fireEvent.keyDown(row(2), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(row(1));
  });
});
