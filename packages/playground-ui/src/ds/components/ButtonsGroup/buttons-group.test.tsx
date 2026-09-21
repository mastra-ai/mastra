// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, assert, describe, expect, it } from 'vitest';

import { Button } from '../Button';
import { DropdownMenu } from '../DropdownMenu';
import { Input } from '../Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select';
import { ButtonsGroup } from './buttons-group';

afterEach(() => {
  cleanup();
});

const getGroup = () => {
  const group = document.querySelector<HTMLDivElement>('[data-slot="buttons-group"]');
  assert(group, 'Expected buttons group');
  return group;
};

const getButton = () => {
  const button = document.querySelector('button');
  assert(button, 'Expected button');
  return button;
};

describe('ButtonsGroup', () => {
  it('a Select trigger stays the last *visible* segment: its only trailing sibling is the aria-hidden form input', () => {
    render(
      <ButtonsGroup>
        <Input variant="outline" placeholder="search" />
        <Select defaultValue="a">
          <SelectTrigger className="rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
      </ButtonsGroup>,
    );

    // Base UI appends a visually-hidden <input aria-hidden> right after the trigger.
    const trigger = getButton();
    const next = trigger.nextElementSibling;
    expect(next?.tagName).toBe('INPUT');
    expect(next?.getAttribute('aria-hidden')).toBe('true');
    // The trigger keeps its own pill corner because the rule ignores that hidden input.
    expect(trigger.className).toContain('rounded-full');
  });

  it('a DropdownMenu trigger composes as a real split-button segment, and the seam survives opening', () => {
    render(
      <ButtonsGroup>
        <Button>Save</Button>
        <DropdownMenu>
          <DropdownMenu.Trigger asChild>
            <Button aria-label="More save options">▾</Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item>Save as draft</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </ButtonsGroup>,
    );
    const group = getGroup();
    const trigger = group.querySelector('[aria-label="More save options"]');
    assert(trigger, 'Expected menu trigger');
    // Closed: DropdownMenu renders no DOM of its own and the menu content is portaled out, so
    // the group has exactly the two button segments — the trigger is the last one (pill corner).
    expect(group.querySelectorAll(':scope > button').length).toBe(2);
    expect(trigger).toBe(group.lastElementChild);

    // Open the menu: Base UI injects visually-hidden focus guards / a positioner anchor as
    // siblings of the trigger (incl. one BEFORE it). The seam must ignore them. This asserts the
    // invariant the CSS relies on: every injected non-button child is a recognizable guard, and
    // the trigger remains the last *real* segment (so the group keeps its right pill corner).
    fireEvent.click(trigger);
    const isGuard = (el: Element) =>
      el.getAttribute('aria-hidden') === 'true' ||
      el.hasAttribute('data-base-ui-focus-guard') ||
      el.hasAttribute('aria-owns');
    const injected = Array.from(group.children).filter(el => el.tagName !== 'BUTTON');
    expect(injected.length).toBeGreaterThan(0); // Base UI did inject guards
    injected.forEach(el => expect(isGuard(el)).toBe(true)); // ...and all are covered by the ignore-list
    const realSegments = Array.from(group.children).filter(el => !isGuard(el));
    expect(realSegments).toEqual([group.firstElementChild, trigger]);
    expect(realSegments[realSegments.length - 1]).toBe(trigger);
  });
});
