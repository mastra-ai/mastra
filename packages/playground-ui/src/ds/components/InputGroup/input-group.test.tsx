// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from './input-group';

afterEach(() => {
  cleanup();
});

const getWrapper = () => document.querySelector<HTMLDivElement>('[data-slot="input-group"]')!;
const getInput = () => document.querySelector<HTMLInputElement>('[data-slot="input-group-control"]')!;

describe('InputGroup', () => {
  it('applies h-form-md to the control by default (md size)', () => {
    render(
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>x</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput placeholder="inline" />
      </InputGroup>,
    );
    const input = getInput();
    expect(input.className).toContain('h-form-md');
    expect(input.className).toContain('flex-1');
  });

  it('applies h-form-lg to the control when wrapper size=lg', () => {
    render(
      <InputGroup size="lg">
        <InputGroupInput placeholder="lg" />
      </InputGroup>,
    );
    expect(getInput().className).toContain('h-form-lg');
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
    // The control still carries the height utility — overrides target the flex shorthand only.
    expect(getInput().className).toContain('h-form-md');
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
});
