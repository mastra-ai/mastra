// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, assert, describe, expect, it } from 'vitest';

import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from './input-group';

afterEach(() => {
  cleanup();
});

const getWrapper = () => {
  const wrapper = document.querySelector<HTMLDivElement>('[data-slot="input-group"]');
  assert(wrapper, 'Expected input group wrapper');
  return wrapper;
};

const getInput = () => {
  const input = document.querySelector<HTMLInputElement>('[data-slot="input-group-control"]');
  assert(input, 'Expected input group control');
  return input;
};

const expectOnlyGuardedHoverBorder = (className: string) => {
  const hoverBorderTokens = className
    .split(/\s+/)
    .filter(token => token.includes('hover') && token.includes('border-foreground/45'));

  expect(hoverBorderTokens).toEqual(['[&:hover:not(:focus-within)]:border-foreground/45']);
  expect(className).toContain('focus-within:border-foreground/60');
  expect(className).not.toContain('hover:border-foreground/45');
};

describe('InputGroup', () => {
  it('puts an explicit height on the root box so the group matches a same-size sibling control', () => {
    render(
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>x</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="inline" />
      </InputGroup>,
    );
    // The root carries an explicit, border-box height. This is the fix for the group
    // rendering ~2px taller than a same-size Select trigger (previously the height lived
    // only on the inner control, so the root's own border was added on top).
    expect(getWrapper().className).toContain('h-form-md');
    expect(getInput().className).toContain('flex-1');
  });

  it('also gives the control a height per group size (so it never collapses in block mode)', () => {
    render(
      <InputGroup size="lg">
        <InputGroupInput placeholder="lg" />
      </InputGroup>,
    );
    // Root height for the size...
    expect(getWrapper().className).toContain('h-form-lg');
    // ...and the control is sized to the root's content box (token minus the 1px borders)
    // via the parent's data-size (no React context). This keeps it from shrinking to the
    // line-height when the group goes vertical, and from overflowing the root inline —
    // which would let a flex-column parent grow the group 2px past a sibling control.
    expect(getInput().className).toContain('group-data-[size=lg]/input-group:h-[calc(var(--spacing-form-lg)-2px)]');
    expect(getInput().className).not.toContain('h-form-lg');
  });

  it('block-start mode: control keeps a form height (no collapse) and the root height goes auto', () => {
    // Regression for the "Block Start Addon" story: with the label stacked above the
    // input (flex-col + flex-none), the control must keep an explicit height or it shrinks
    // to the text line-height. The control carries a `group-data-[size]:h-[calc(...)]`
    // height for that, and the root releases its fixed height to auto so addon + control both fit.
    render(
      <InputGroup>
        <InputGroupAddon align="block-start">
          <InputGroupText>Recipient</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="name@example.com" />
      </InputGroup>,
    );
    expect(getInput().className).toContain('group-data-[size=md]/input-group:h-[calc(var(--spacing-form-md)-2px)]');
    expect(getWrapper().className).toContain('has-[>[data-align=block-start]]:h-auto');
  });

  it('the root does NOT expose a zero min-width (would let it collapse to ~0 inside a flex group)', () => {
    render(
      <InputGroup variant="outline">
        <InputGroupInput placeholder="x" />
      </InputGroup>,
    );
    // Root fills via `flex-1` + `w-full` and keeps its `min-width:auto` content floor.
    const cls = getWrapper().className;
    expect(cls).toContain('flex-1');
    expect(cls).not.toContain('min-w-0');
  });

  it('wrapper has the flex-col + flex-none + w-full overrides needed for block-start mode', () => {
    // Regression test: in flex-col, `flex-1` (flex-basis: 0%) collapses the control's height
    // to 0 unless we force `flex-none` and `w-full`. The wrapper className must carry the
    // descendant overrides that kick in via :has().
    render(
      <InputGroup>
        <InputGroupAddon align="block-start">
          <InputGroupText>Recipient</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="block" />
      </InputGroup>,
    );
    const wrapperClass = getWrapper().className;
    expect(wrapperClass).toContain('has-[>[data-align=block-start]]:flex-col');
    expect(wrapperClass).toContain('has-[>[data-align=block-start]]:[&>[data-slot=input-group-control]]:flex-none');
    expect(wrapperClass).toContain('has-[>[data-align=block-start]]:[&>[data-slot=input-group-control]]:w-full');
    // In block mode the fixed root height is released to auto so the stacked addon + control fit.
    expect(wrapperClass).toContain('has-[>[data-align=block-start]]:h-auto');
  });

  it('wrapper has block-end equivalents of the flex-col overrides', () => {
    render(
      <InputGroup>
        <InputGroupInput placeholder="msg" />
        <InputGroupAddon align="block-end">
          <InputGroupText>footer</InputGroupText>
        </InputGroupAddon>
      </InputGroup>,
    );
    const wrapperClass = getWrapper().className;
    expect(wrapperClass).toContain('has-[>[data-align=block-end]]:flex-col');
    expect(wrapperClass).toContain('has-[>[data-align=block-end]]:[&>[data-slot=input-group-control]]:flex-none');
    expect(wrapperClass).toContain('has-[>[data-align=block-end]]:[&>[data-slot=input-group-control]]:w-full');
  });

  it('inline-start addon zeros the control left padding', () => {
    render(
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>@</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="x" />
      </InputGroup>,
    );
    expect(getWrapper().className).toContain(
      'has-[>[data-align=inline-start]]:[&>[data-slot=input-group-control]]:pl-0',
    );
  });

  it('aria-invalid on control turns wrapper into error state via :has', () => {
    render(
      <InputGroup>
        <InputGroupInput placeholder="x" error />
      </InputGroup>,
    );
    expect(getInput().getAttribute('aria-invalid')).toBe('true');
    expect(getWrapper().className).toContain('has-[[aria-invalid=true]]:border-error');
  });

  it('still renders the filled surface for a call site on the removed filled variant', () => {
    render(
      <InputGroup variant="filled">
        <InputGroupInput placeholder="x" />
      </InputGroup>,
    );

    expect(getWrapper().className).toContain('bg-foreground/10');
  });

  it('supports an outline variant without an initial filled background', () => {
    render(
      <InputGroup variant="outline">
        <InputGroupInput placeholder="x" />
      </InputGroup>,
    );

    const wrapperClass = getWrapper().className;
    expect(wrapperClass).toContain('bg-transparent');
    expect(wrapperClass).toContain('rounded-full');
    expect(wrapperClass).not.toContain('bg-foreground/10');
  });

  it('suppresses both native number spinners (WebKit + Firefox) and the WebKit search clear button', () => {
    render(
      <InputGroup>
        <InputGroupInput placeholder="x" />
      </InputGroup>,
    );
    const cls = getInput().className;
    // WebKit number spinners + Firefox textfield appearance + WebKit search clear, so a
    // type="number"/type="search" control composes cleanly with custom +/- or clear buttons.
    expect(cls).toContain('[&::-webkit-inner-spin-button]:appearance-none');
    expect(cls).toContain('[&[type=number]]:[appearance:textfield]');
    expect(cls).toContain('[&::-webkit-search-cancel-button]:appearance-none');
  });

  it('prioritizes the focus border over hover for the outline variant', () => {
    render(
      <InputGroup variant="outline">
        <InputGroupInput placeholder="outline" />
      </InputGroup>,
    );
    const cls = getWrapper().className;

    // Focused border brightens to a neutral tone (no green accent), and the hover border
    // is guarded so it cannot override focus when the group is focused and hovered.
    expectOnlyGuardedHoverBorder(cls);
    expect(cls).not.toContain('ring-accent1');
  });

  it('carries the default variant hover in the fill, leaving its border alone', () => {
    render(
      <InputGroup>
        <InputGroupInput placeholder="default" />
      </InputGroup>,
    );
    const cls = getWrapper().className;

    expect(cls).toContain('hover:bg-foreground/14');
    expect(cls).toContain('focus-within:border-foreground/60');
    expect(cls.split(/\s+/).filter(token => token.includes('hover') && token.includes('border-'))).toEqual([]);
  });
});
