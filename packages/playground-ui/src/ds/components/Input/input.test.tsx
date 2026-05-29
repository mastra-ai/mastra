// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Input } from './input';

afterEach(() => {
  cleanup();
});

describe('Input', () => {
  it('keeps the filled surface as the default variant', () => {
    render(<Input placeholder="Name" />);

    expect(screen.getByPlaceholderText('Name').className).toContain('bg-surface-overlay-soft');
  });

  it('supports an outline variant without an initial filled background', () => {
    render(<Input variant="outline" placeholder="Name" />);

    const input = screen.getByPlaceholderText('Name');
    expect(input.className).toContain('bg-transparent');
    expect(input.className).toContain('rounded-full');
    expect(input.className).not.toContain('bg-surface-overlay-soft');
  });

  it('moves the styled box to a wrapper when an icon is present so the input stays transparent', () => {
    render(<Input variant="outline" leadingIcon={<svg data-testid="search" />} placeholder="Search" />);

    const input = screen.getByPlaceholderText('Search');
    // The input itself is borderless; the wrapper carries the outline box.
    expect(input.className).toContain('bg-transparent');
    expect(input.className).toContain('border-0');

    const wrapper = input.parentElement!;
    expect(wrapper.className).toContain('rounded-full');
    // Focus is hoisted to the wrapper via :has() so the brightened border follows its
    // rounded shape instead of drawing a square outline on the rectangular inner input.
    expect(wrapper.className).toContain('has-[input:focus-visible]:border-neutral5/50');
    expect(screen.getByTestId('search')).toBeTruthy();
  });

  it('brightens the border on focus so focus clears WCAG non-text contrast (no green accent)', () => {
    render(<Input placeholder="Name" />);

    const cls = screen.getByPlaceholderText('Name').className;
    expect(cls).toContain('focus-visible:border-neutral5/50');
    expect(cls).not.toContain('ring-accent1');
    expect(cls).not.toContain('focus-visible:border-accent1');
  });

  it('icon-mode error border survives focus: the wrapper uses the :has() hook, not an inert focus-visible', () => {
    render(<Input leadingIcon={<svg data-testid="search" />} placeholder="Search" error />);

    const wrapper = screen.getByPlaceholderText('Search').parentElement!;
    // The wrapper is a non-focusable div, so a plain `focus-visible:border-error` would be inert
    // and the neutral `has-[input:focus-visible]:border-neutral5/50` would win on focus. Driving
    // the error off the same :has() hook gives it equal (0,2,1) specificity, and tailwind-merge
    // then drops the redundant neutral has-border, so the red border stays at rest AND on focus.
    expect(wrapper.className).toContain('border-error');
    expect(wrapper.className).toContain('has-[input:focus-visible]:border-error');
    expect(wrapper.className).not.toContain('has-[input:focus-visible]:border-neutral5/50');
  });
});
