// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TracesLayout } from '../traces-layout';

afterEach(cleanup);

const list = <div data-testid="list">list</div>;

describe('TracesLayout', () => {
  it('renders only the list when there is no trace panel', () => {
    render(<TracesLayout listSlot={list} />);

    expect(screen.getByTestId('list')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the trace panel as an absolute overlay covering the whole frame', () => {
    render(<TracesLayout listSlot={list} tracePanelSlot={<div data-testid="trace-panel">trace</div>} />);

    const dialog = screen.getByRole('dialog', { name: 'Trace details' });
    expect(dialog.contains(screen.getByTestId('trace-panel'))).toBe(true);
    expect(dialog.className).toContain('absolute');
    expect(dialog.className).toContain('inset-0');
  });

  it('keeps the overlay full-frame when a span panel is shown', () => {
    render(
      <TracesLayout
        listSlot={list}
        tracePanelSlot={<div>trace</div>}
        spanPanelSlot={<div data-testid="span">span</div>}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(screen.getByTestId('span'))).toBe(true);
    expect(dialog.className).toContain('inset-0');
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
