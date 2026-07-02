// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Button } from '../Button';
import { DropdownMenu } from '../DropdownMenu';
import { Input } from '../Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select';
import { ButtonsGroup } from './buttons-group';
import { assertDefined } from '@/test-utils/assert';

afterEach(() => {
  cleanup();
});

const getGroup = () =>
  assertDefined(document.querySelector<HTMLDivElement>('[data-slot="buttons-group"]'), 'Expected buttons group');

const getButton = () => assertDefined(document.querySelector('button'), 'Expected button');

describe('ButtonsGroup', () => {
  it('close spacing keys the right-edge rounding off a visible next sibling (not :last-child)', () => {
    render(
      <ButtonsGroup spacing="close">
        <Button>One</Button>
        <Button>Two</Button>
      </ButtonsGroup>,
    );

    const cls = getGroup().className;
    // Robust rule: a child rounds its right corner flat only when a *real* segment follows it
    // anywhere (general sibling `~`), ignoring injected non-segments (aria-hidden inputs, Base UI
    // focus guards, positioner anchors). Adjacent `+` would break when a framework injects a
    // node between two segments (e.g. an open DropdownMenu's focus guard before its trigger).
    expect(cls).toContain(
      '[&>*:has(~_*:not([aria-hidden=true]):not([data-base-ui-focus-guard]):not([aria-owns]))]:rounded-r-none',
    );
    // The brittle structural rules must be gone.
    expect(cls).not.toContain('[&>*:not(:last-child)]:rounded-r-none');
    expect(cls).not.toContain('[&>*:has(+_*:not([aria-hidden=true]))]:rounded-r-none');
  });

  it('a Select trigger stays the last *visible* segment: its only trailing sibling is the aria-hidden form input', () => {
    render(
      <ButtonsGroup spacing="close">
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

  it('close spacing overlaps borders (-ml-px) and lifts the hovered/focused segment so its full border shows', () => {
    render(
      <ButtonsGroup spacing="close">
        <Button>One</Button>
        <Button>Two</Button>
      </ButtonsGroup>,
    );
    const cls = getGroup().className;
    // Overlap by 1px (no reflow) and keep all four border slots; the overlapped left
    // border is transparent at rest (single-opacity seam, no doubled translucent line),
    // and the hover / keyboard-focus z-10 lift makes the active segment paint its complete
    // border on top — so no "missing side" and the seam follows the active colour.
    expect(cls).toContain(':-ml-px');
    expect(cls).not.toContain(':border-l-0');
    // Transparent-at-rest seam: revealed on :hover and keyboard focus (:focus-visible /
    // :has(:focus-visible)), NOT on :focus-within — a mouse click leaves a plain :focus on a
    // button, which must not keep its seam border highlighted. So `:focus-within` is gone.
    expect(cls).toContain(':not(:hover):not(:focus-visible):not(:has(:focus-visible))]:border-l-transparent');
    expect(cls).not.toContain(':focus-within');
    expect(cls).toContain('[&>*:hover]:z-10');
    expect(cls).toContain('[&>*:focus-visible]:z-10');
    expect(cls).toContain('[&>*:has(:focus-visible)]:z-10');
  });

  it('close spacing draws ONE seam for FILLED (opaque-bg) segments by keeping their own border, not a doubling inset shadow', () => {
    render(
      <ButtonsGroup spacing="close">
        <Button>Cancel</Button>
        <Button aria-label="menu">▾</Button>
      </ButtonsGroup>,
    );
    // Filled buttons expose their variant so the group can target them...
    const buttons = document.querySelectorAll('button');
    expect(buttons[1].getAttribute('data-variant')).toBe('default');
    const cls = getGroup().className;
    // ...and are EXCLUDED from the transparent-left-border rule, so a filled segment keeps
    // its own 1px border as the single seam (its opaque bg hides the neighbour's border).
    // The previous inset-shadow approach was 1px off the covered border → a 2px double line.
    expect(cls).toContain(':not([data-variant=default]):not([data-variant=primary])');
    expect(cls).not.toContain('[data-variant=default]:not([aria-hidden=true]):not(:first-child)]:shadow-[inset');
    // `primary` is borderless-filled, so it (only) gets an inset-shadow divider.
    expect(cls).toContain(
      '[&>[data-variant=primary]:not([aria-hidden=true]):not(:first-child)]:shadow-[inset_1px_0_0_0_var(--color-border1)]',
    );
    // Anti-flicker: grouped segments only transition colour/background (border + ring snap).
    expect(cls).toContain(':transition-[color,background-color]');
  });

  it('close spacing sizes a Select trigger to content so the dropdown stays natural width with no consumer class', () => {
    render(
      <ButtonsGroup spacing="close">
        <Input variant="outline" placeholder="search" />
        <Select defaultValue="a">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
      </ButtonsGroup>,
    );
    // The group pins a direct-child select-trigger to content width (overrides the
    // trigger's own `w-full`), so consumers don't need `shrink-0`/`w-fit`.
    expect(getGroup().className).toContain('[&>[data-slot=select-trigger]]:w-fit');
    // And the trigger actually carries the data-slot the rule targets.
    expect(getButton().getAttribute('data-slot')).toBe('select-trigger');
  });

  it('a DropdownMenu trigger composes as a real split-button segment, and the seam survives opening', () => {
    render(
      <ButtonsGroup spacing="close">
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
    const trigger = assertDefined(group.querySelector('[aria-label="More save options"]'), 'Expected menu trigger');
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
