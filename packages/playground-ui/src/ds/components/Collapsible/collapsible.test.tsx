// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible';

afterEach(() => {
  cleanup();
});

describe('Collapsible', () => {
  it('mounts trigger and content in an open collapsible without throwing', () => {
    expect(() =>
      render(
        <Collapsible defaultOpen>
          <CollapsibleTrigger>Toggle</CollapsibleTrigger>
          <CollapsibleContent>Panel content</CollapsibleContent>
        </Collapsible>,
      ),
    ).not.toThrow();

    expect(screen.getByText('Panel content')).toBeDefined();
  });

  it('renders an asChild Trigger as the child element without nesting buttons', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger asChild>
          <button type="button">Toggle panel</button>
        </CollapsibleTrigger>
        <CollapsibleContent>Panel content</CollapsibleContent>
      </Collapsible>,
    );

    const trigger = screen.getByRole('button', { name: 'Toggle panel' });
    expect(trigger.querySelector('button')).toBeNull();
  });

  it('toggles the panel when the trigger is clicked', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Panel content</CollapsibleContent>
      </Collapsible>,
    );

    expect(screen.queryByText('Panel content')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(screen.getByText('Panel content')).toBeDefined();
  });

  it('renders the disclosure variant as a chevron followed by the label, turning while open', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger variant="disclosure">Advanced</CollapsibleTrigger>
        <CollapsibleContent>Panel content</CollapsibleContent>
      </Collapsible>,
    );

    const trigger = screen.getByRole('button', { name: 'Advanced' });
    expect(trigger.dataset.variant).toBe('disclosure');
    expect(trigger.firstElementChild?.getAttribute('data-slot')).toBe('disclosure-chevron');
    expect(trigger.firstElementChild?.classList.contains('in-aria-expanded:rotate-90')).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Panel content')).toBeDefined();
  });

  it('adds no chevron to the default variant or to an asChild trigger', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Plain</CollapsibleTrigger>
        <CollapsibleTrigger variant="disclosure" asChild>
          <button type="button">Custom</button>
        </CollapsibleTrigger>
      </Collapsible>,
    );

    expect(document.querySelector('[data-slot="disclosure-chevron"]')).toBeNull();
  });

  it('places the built-in chevron before or after the children at the requested size', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger chevron="start" chevronSize="xs">
          Leading
        </CollapsibleTrigger>
        <CollapsibleTrigger chevron="end">Trailing</CollapsibleTrigger>
      </Collapsible>,
    );

    const leading = screen.getByRole('button', { name: 'Leading' });
    expect(leading.firstElementChild?.getAttribute('data-slot')).toBe('disclosure-chevron');
    expect(leading.firstElementChild?.classList.contains('size-icon-xs')).toBe(true);

    const trailing = screen.getByRole('button', { name: 'Trailing' });
    expect(trailing.lastElementChild?.getAttribute('data-slot')).toBe('disclosure-chevron');
    expect(trailing.lastElementChild?.classList.contains('size-icon-md')).toBe(true);
    expect(trailing.firstChild?.textContent).toBe('Trailing');
  });
});
