// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DisclosureChevron } from '../DisclosureChevron';
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

  it('turns a DisclosureChevron in the trigger from the trigger aria-expanded state', () => {
    render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>
          Toggle
          <DisclosureChevron direction="right" />
        </CollapsibleTrigger>
        <CollapsibleContent>Panel content</CollapsibleContent>
      </Collapsible>,
    );

    const trigger = screen.getByRole('button', { name: 'Toggle' });
    const chevron = trigger.querySelector('[data-slot="disclosure-chevron"]');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(chevron?.classList.contains('in-aria-expanded:rotate-90')).toBe(true);

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
