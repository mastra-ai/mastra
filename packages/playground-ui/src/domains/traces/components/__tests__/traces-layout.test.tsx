// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TracesLayout } from '../traces-layout';

afterEach(cleanup);

const list = <div data-testid="list">list</div>;

describe('TracesLayout', () => {
  it('renders only the list when there is no trace panel', () => {
    const { container } = render(<TracesLayout listSlot={list} />);

    expect(screen.getByTestId('list')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(container.querySelector('[aria-hidden]')).toBeNull();
  });

  it('renders the trace panel as a full-height absolute overlay on the right', () => {
    const { container } = render(
      <TracesLayout listSlot={list} tracePanelSlot={<div data-testid="trace-panel">trace</div>} />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Trace details' });
    expect(dialog.contains(screen.getByTestId('trace-panel'))).toBe(true);
    expect(dialog.className).toContain('absolute');
    expect(dialog.className).toContain('inset-y-0');
    expect(dialog.className).toContain('right-0');
    expect(dialog.className).toContain('w-1/2');
    // The list grid keeps a spacer column so the list stays on the left half.
    expect(container.querySelector('[aria-hidden]')).toBeTruthy();
  });

  describe('sidePanelWidth', () => {
    const listGrid = (container: HTMLElement) => container.firstElementChild as HTMLElement;

    it('defaults to half of the frame', () => {
      const { container } = render(<TracesLayout listSlot={list} tracePanelSlot={<div>trace</div>} />);

      expect(screen.getByRole('dialog').className).toContain('w-1/2');
      expect(listGrid(container).className).toContain('grid-cols-[1fr_1fr]');
    });

    it('widens the overlay to 4/5 when wide', () => {
      const { container } = render(
        <TracesLayout listSlot={list} tracePanelSlot={<div>trace</div>} sidePanelWidth="wide" />,
      );

      expect(screen.getByRole('dialog').className).toContain('w-4/5');
      expect(listGrid(container).className).toContain('grid-cols-[1fr_4fr]');
    });

    it('covers the whole frame when full', () => {
      const { container } = render(
        <TracesLayout listSlot={list} tracePanelSlot={<div>trace</div>} sidePanelWidth="full" />,
      );

      expect(screen.getByRole('dialog').className).toContain('w-full');
      expect(listGrid(container).className).toContain('grid-cols-[1fr_4fr]');
    });
  });

  it('stacks the score panel inside the overlay', () => {
    render(
      <TracesLayout
        listSlot={list}
        tracePanelSlot={<div>trace</div>}
        scorePanelSlot={<div data-testid="score-panel">score</div>}
      />,
    );

    expect(screen.getByRole('dialog').contains(screen.getByTestId('score-panel'))).toBe(true);
  });
});
