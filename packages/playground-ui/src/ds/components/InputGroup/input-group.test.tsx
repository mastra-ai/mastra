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
    expect(getWrapper().className).toContain('h-form-md');
    expect(getInput().className).toContain('flex-1');
  });

  it('also gives the control a height per group size (so it never collapses in block mode)', () => {
    render(
      <InputGroup size="lg">
        <InputGroupInput placeholder="lg" />
      </InputGroup>,
    );
    expect(getWrapper().className).toContain('h-form-lg');
    expect(getInput().className).toContain('group-data-[size=lg]/input-group:h-[calc(var(--spacing-form-lg)-2px)]');
    expect(getInput().className).not.toContain('h-form-lg');
  });

  it('block-start mode: control keeps a form height (no collapse) and the root height goes auto', () => {
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
    const cls = getWrapper().className;
    expect(cls).toContain('flex-1');
    expect(cls).not.toContain('min-w-0');
  });

  it('wrapper has the flex-col + flex-none + w-full overrides needed for block-start mode', () => {
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

  it('supports an outline variant without an initial filled background', () => {
    render(
      <InputGroup variant="outline">
        <InputGroupInput placeholder="x" />
      </InputGroup>,
    );

    const wrapperClass = getWrapper().className;
    expect(wrapperClass).toContain('bg-transparent');
    expect(wrapperClass).toContain('rounded-full');
    expect(wrapperClass).not.toContain('bg-surface-overlay-soft');
  });

  it('suppresses both native number spinners (WebKit + Firefox) and the WebKit search clear button', () => {
    render(
      <InputGroup>
        <InputGroupInput placeholder="x" />
      </InputGroup>,
    );
    const cls = getInput().className;
    expect(cls).toContain('[&::-webkit-inner-spin-button]:appearance-none');
    expect(cls).toContain('[&[type=number]]:[appearance:textfield]');
    expect(cls).toContain('[&::-webkit-search-cancel-button]:appearance-none');
  });
});
