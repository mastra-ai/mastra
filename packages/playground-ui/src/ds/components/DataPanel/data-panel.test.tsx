// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select';
import { TooltipProvider } from '../Tooltip';
import { DataPanel } from './data-panel';

// Base UI's Select synthesizes PointerEvents on interaction, which jsdom does
// not implement. Polyfill it with the available MouseEvent constructor.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

afterEach(() => cleanup());

const POPUP = '[data-slot="data-panel-popup"]';

describe('DataPanel', () => {
  it('renders an accessible dialog named by title when open', () => {
    render(
      <DataPanel open title="Span details">
        <DataPanel.Content>Panel body</DataPanel.Content>
      </DataPanel>,
    );

    expect(screen.getByRole('dialog', { name: 'Span details' })).toBeDefined();
    expect(screen.getByText('Panel body')).toBeDefined();
    expect(document.querySelector(POPUP)?.getAttribute('data-swipe-direction')).toBe('right');
  });

  it('renders nothing when closed', () => {
    render(
      <DataPanel open={false} title="Span details">
        <DataPanel.Content>Panel body</DataPanel.Content>
      </DataPanel>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('calls onClose from the close button and from Escape', () => {
    const onClose = vi.fn();

    render(
      <TooltipProvider>
        <DataPanel open title="Span details" onClose={onClose}>
          <DataPanel.Header>
            <DataPanel.Heading>Span</DataPanel.Heading>
            <DataPanel.CloseButton onClick={onClose} />
          </DataPanel.Header>
          <DataPanel.Content>Panel body</DataPanel.Content>
        </DataPanel>
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close Panel' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('marks the body as swipe-exempt drawer content', () => {
    render(
      <DataPanel open title="Span details">
        <DataPanel.Content>
          <span>Selectable body</span>
        </DataPanel.Content>
      </DataPanel>,
    );

    expect(screen.getByText('Selectable body').closest('[data-drawer-content]')).not.toBeNull();
  });

  it('portals a nested Select into a swipe-exempt region inside the popup', async () => {
    render(
      <DataPanel open title="Span details">
        <DataPanel.Content>
          <Select defaultValue="apple">
            <SelectTrigger>
              <SelectValue placeholder="Pick one" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apple">Apple</SelectItem>
              <SelectItem value="banana">Banana</SelectItem>
            </SelectContent>
          </Select>
        </DataPanel.Content>
      </DataPanel>,
    );

    fireEvent.click(screen.getByRole('combobox'));

    const option = await screen.findByRole('option', { name: 'Banana' });

    expect(document.querySelector(POPUP)?.contains(option)).toBe(true);
    expect(option.closest('[data-drawer-content]')).not.toBeNull();
  });

  it('stacks a nested DataPanel on top of its parent', () => {
    render(
      <DataPanel open title="Span details">
        <DataPanel.Content>
          Parent body
          <DataPanel open title="Score details">
            <DataPanel.Content>Nested body</DataPanel.Content>
          </DataPanel>
        </DataPanel.Content>
      </DataPanel>,
    );

    expect(screen.getByRole('dialog', { name: 'Score details' })).toBeDefined();

    const popups = document.querySelectorAll(POPUP);
    expect(popups).toHaveLength(2);
    expect(popups[0]?.hasAttribute('data-nested-drawer-open')).toBe(true);
  });
});
