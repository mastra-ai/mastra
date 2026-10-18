// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, assert, describe, expect, it } from 'vitest';

import { Field } from '../Field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from './input-group';

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

describe('InputGroupAddon variants', () => {
  it.each([
    { align: 'inline-start', padding: 'pl' },
    { align: 'inline-end', padding: 'pr' },
  ] as const)('removes the gap and outside inset only for flush $align addons', ({ align, padding }) => {
    render(
      <>
        <InputGroup>
          <InputGroupInput aria-label="Default input" />
          <InputGroupAddon align={align} aria-label="Default addon">
            <InputGroupButton>Default action</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupInput aria-label="Flush input" />
          <InputGroupAddon align={align} variant="flush" aria-label="Flush addon">
            <InputGroupButton>Flush action</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </>,
    );

    const defaultAddon = screen.getByRole('group', { name: 'Default addon' });
    const flushAddon = screen.getByRole('group', { name: 'Flush addon' });
    const defaultClasses = defaultAddon.className.split(/\s+/);
    const flushClasses = flushAddon.className.split(/\s+/);

    expect(defaultAddon.getAttribute('data-variant')).toBe('default');
    expect(defaultClasses).toEqual(expect.arrayContaining(['gap-2', `${padding}-3`, `has-[>button]:${padding}-1`]));
    expect(defaultClasses).not.toContain('[&>button]:mx-0');

    expect(flushAddon.getAttribute('data-variant')).toBe('flush');
    expect(flushClasses).toEqual(
      expect.arrayContaining(['gap-0', `${padding}-0`, `has-[>button]:${padding}-0`, '[&>button]:mx-0']),
    );
    expect(flushClasses).not.toContain('gap-2');
    expect(flushClasses).not.toContain(`${padding}-3`);
    expect(flushClasses).not.toContain(`has-[>button]:${padding}-1`);
  });

  it.each(['block-start', 'block-end'] as const)('keeps %s spacing when flush is selected', align => {
    render(
      <>
        <InputGroup>
          <InputGroupInput aria-label="Default input" />
          <InputGroupAddon align={align} aria-label="Default addon">
            <InputGroupButton>Default action</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <InputGroup>
          <InputGroupInput aria-label="Flush input" />
          <InputGroupAddon align={align} variant="flush" aria-label="Flush addon">
            <InputGroupButton>Flush action</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </>,
    );

    const defaultAddon = screen.getByRole('group', { name: 'Default addon' });
    const flushAddon = screen.getByRole('group', { name: 'Flush addon' });
    expect(flushAddon.getAttribute('data-variant')).toBe('flush');
    expect(flushAddon.className).toBe(defaultAddon.className);
    expect(flushAddon.className.split(/\s+/)).toEqual(expect.arrayContaining(['gap-2', 'px-3']));
    expect(flushAddon.className.split(/\s+/)).not.toContain('[&>button]:mx-0');
  });
});

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
    expect(getWrapper().className).toContain('h-control-md');
    expect(getInput().className).toContain('flex-1');
  });

  it('also gives the control a height per group size (so it never collapses in block mode)', () => {
    render(
      <InputGroup size="lg">
        <InputGroupInput placeholder="lg" />
      </InputGroup>,
    );
    // Root height for the size...
    expect(getWrapper().className).toContain('h-control-lg');
    // ...and the control is sized to the root's content box (token minus the 1px borders)
    // via the parent's data-size (no React context). This keeps it from shrinking to the
    // line-height when the group goes vertical, and from overflowing the root inline —
    // which would let a flex-column parent grow the group 2px past a sibling control.
    expect(getInput().className).toContain('group-data-[size=lg]/input-group:h-[calc(var(--spacing-control-lg)-2px)]');
    expect(getInput().className).not.toContain('h-control-lg');
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
    expect(getInput().className).toContain('group-data-[size=md]/input-group:h-[calc(var(--spacing-control-md)-2px)]');
    expect(getWrapper().className).toContain('has-[>[data-align=block-start]]:h-auto');
  });

  it('the root does NOT expose a zero min-width (would let it collapse to ~0 inside a flex group)', () => {
    render(
      <InputGroup>
        <InputGroupInput placeholder="x" />
      </InputGroup>,
    );
    // Root fills via `flex-1` + `w-full` and keeps its `min-width:auto` content floor.
    const cls = getWrapper().className;
    expect(cls).toContain('flex-1');
    expect(cls.split(/\s+/)).not.toContain('min-w-0');
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

  it('an invalid field marks the control, which turns the wrapper into its error state via :has', () => {
    render(
      <Field invalid>
        <InputGroup>
          <InputGroupInput placeholder="x" />
        </InputGroup>
      </Field>,
    );
    expect(getInput().getAttribute('aria-invalid')).toBe('true');
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
});
