// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '../Tooltip';
import { CreateButton } from './CreateButton';

afterEach(() => {
  cleanup();
});

const pressC = (target: Element | Window = window) => fireEvent.keyDown(target, { key: 'c' });

describe('CreateButton', () => {
  it('renders the Plus icon in the icon slot and the label', () => {
    render(<CreateButton tooltip="Create">New item</CreateButton>);

    const button = screen.getByRole('button', { name: 'New item' });
    const slot = button.querySelector('[data-slot="button-icon"]');
    expect(slot).not.toBeNull();
    expect(slot?.querySelector('svg')).not.toBeNull();
  });

  it('triggers onClick when pressing C', () => {
    const onClick = vi.fn();
    render(
      <CreateButton tooltip="Create" onClick={onClick}>
        New item
      </CreateButton>,
    );

    pressC();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onClick when disabled', () => {
    const onClick = vi.fn();
    render(
      <CreateButton tooltip="Create" onClick={onClick} disabled>
        New item
      </CreateButton>,
    );

    pressC();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not trigger onClick when shortcutEnabled is false', () => {
    const onClick = vi.fn();
    render(
      <CreateButton tooltip="Create" onClick={onClick} shortcutEnabled={false}>
        New item
      </CreateButton>,
    );

    pressC();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('ignores C typed inside an editable field', () => {
    const onClick = vi.fn();
    render(
      <>
        <input aria-label="search" />
        <CreateButton tooltip="Create" onClick={onClick}>
          New item
        </CreateButton>
      </>,
    );

    const input = screen.getByLabelText('search');
    input.focus();
    pressC(input);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('forwards the ref to the underlying button', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <CreateButton tooltip="Create" ref={ref}>
        New item
      </CreateButton>,
    );

    expect(ref.current).toBe(screen.getByRole('button', { name: 'New item' }));
  });

  it('shows the tooltip text followed by a C kbd hint', async () => {
    render(
      <TooltipProvider delay={0}>
        <CreateButton tooltip="Create a new item">New item</CreateButton>
      </TooltipProvider>,
    );

    const button = screen.getByRole('button', { name: 'New item' });
    fireEvent.pointerEnter(button);
    fireEvent.mouseEnter(button);
    fireEvent.pointerMove(button);
    fireEvent.mouseMove(button);
    button.focus();

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('Create a new item');
    const kbd = tooltip.querySelector('kbd');
    expect(kbd?.textContent).toBe('C');
  });
});
