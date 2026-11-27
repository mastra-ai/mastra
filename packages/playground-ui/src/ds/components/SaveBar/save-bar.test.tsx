// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveBar } from './save-bar';

const animate = vi.fn();
let reduced = false;

beforeEach(() => {
  animate.mockClear();
  reduced = false;
  HTMLElement.prototype.animate = animate;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: reduced && query.includes('reduce') }));
});

afterEach(cleanup);

describe('SaveBar', () => {
  it('announces a neutral status politely and does not move', () => {
    render(<SaveBar status="Saved as a draft." />);

    expect(screen.getByRole('status').textContent).toBe('Saved as a draft.');
    expect(animate).not.toHaveBeenCalled();
  });

  it('announces an error as an alert and shakes once when the tone turns to error', () => {
    const { rerender } = render(<SaveBar status="Publishing" />);
    rerender(<SaveBar status="Couldn’t publish." tone="error" />);
    rerender(<SaveBar status="Couldn’t publish again." tone="error" />);

    expect(screen.getByRole('alert').textContent).toBe('Couldn’t publish again.');
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('keeps still for people who prefer reduced motion', () => {
    reduced = true;
    render(<SaveBar status="Couldn’t publish." tone="error" />);

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(animate).not.toHaveBeenCalled();
  });

  it('marks its tone for styling and keeps its actions mounted across tones', () => {
    const { container, rerender } = render(
      <SaveBar status="Publishing">
        <button type="button">Publish</button>
      </SaveBar>,
    );
    const button = screen.getByRole('button', { name: 'Publish' });
    rerender(
      <SaveBar status="Published." tone="success">
        <button type="button">Publish</button>
      </SaveBar>,
    );

    expect(container.querySelector('[data-slot="save-bar"]')?.getAttribute('data-tone')).toBe('success');
    expect(screen.getByRole('button', { name: 'Publish' })).toBe(button);
  });
});
