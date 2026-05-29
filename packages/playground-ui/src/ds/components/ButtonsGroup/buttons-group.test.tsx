// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Button } from '../Button';
import { DropdownMenu } from '../DropdownMenu';
import { Input } from '../Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../Select';
import { ButtonsGroup } from './buttons-group';

afterEach(() => {
  cleanup();
});

const getGroup = () => document.querySelector<HTMLDivElement>('[data-slot="buttons-group"]')!;

describe('ButtonsGroup', () => {
  it('close spacing keys the right-edge rounding off a visible next sibling (not :last-child)', () => {
    render(
      <ButtonsGroup spacing="close">
        <Button>One</Button>
        <Button>Two</Button>
      </ButtonsGroup>,
    );

    const cls = getGroup().className;
    // Robust rule: a child rounds its right corner flat only when a *visible* sibling follows it.
    expect(cls).toContain('[&>*:has(+_*:not([aria-hidden=true]))]:rounded-r-none');
    // The brittle structural rule must be gone, otherwise a trailing hidden input
    // (see the Select test below) would square off the last visible segment.
    expect(cls).not.toContain('[&>*:not(:last-child)]:rounded-r-none');
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
    const trigger = document.querySelector('button')!;
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
    // and the hover/focus z-10 lift makes the active segment paint its complete border on
    // top — so no "missing side" and the seam follows the hover colour.
    expect(cls).toContain(':-ml-px');
    expect(cls).not.toContain(':border-l-0');
    // Transparent-at-rest seam: excluded on :hover/:focus-within so the active colour shows.
    expect(cls).toContain(':not(:hover):not(:focus-within)]:border-l-transparent');
    expect(cls).toContain('[&>*:hover]:relative');
    expect(cls).toContain('[&>*:hover]:z-10');
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
    expect(document.querySelector('button')!.getAttribute('data-slot')).toBe('select-trigger');
  });

  it('a DropdownMenu trigger composes as a real split-button segment (no DOM wrapper, stays the last child)', () => {
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
    // DropdownMenu renders no DOM of its own and the (closed) menu content is portaled out,
    // so the group has exactly the two button segments as direct children — the split button.
    expect(group.querySelectorAll(':scope > button').length).toBe(2);
    // The trigger stays the last segment, so the group keeps its pill corner on that side
    // (the right-edge rounding keys off a visible *next* sibling, and there is none).
    expect(group.querySelector('[aria-label="More save options"]')).toBe(group.lastElementChild);
  });
});
