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
    expect(screen.getByTestId('search')).toBeTruthy();
  });
});
