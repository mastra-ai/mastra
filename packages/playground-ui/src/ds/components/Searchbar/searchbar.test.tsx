// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Searchbar } from './searchbar';

afterEach(() => {
  cleanup();
});

describe('Searchbar', () => {
  it('supports an outline variant without an initial filled background', () => {
    render(<Searchbar variant="outline" label="Search" placeholder="Search..." onSearch={() => {}} />);

    const wrapperClass = screen.getByPlaceholderText('Search...').closest('div[class*="border-border1"]')?.className;
    expect(wrapperClass).toContain('bg-transparent');
    expect(wrapperClass).toContain('rounded-full');
    expect(wrapperClass).not.toContain('bg-surface-overlay-soft');
  });

  it('prioritizes the focus border over hover like Input (the hover border is guarded so focus always wins)', () => {
    render(<Searchbar label="Search" placeholder="Search..." onSearch={() => {}} />);

    const wrapperClass =
      screen.getByPlaceholderText('Search...').closest('div[class*="border-border1"]')?.className ?? '';
    // The Searchbar wrapper focuses via :focus-within (focus lives on the nested input), which
    // Tailwind emits before :hover — so the hover border must be guarded with :not(:focus-within)
    // or it would override the focus border on a focused+hovered field (the InputGroup bug).
    expect(wrapperClass).toContain('focus-within:border-neutral5/50');
    expect(wrapperClass).toContain('[&:hover:not(:focus-within)]:border-border2');
    expect(wrapperClass).not.toContain('hover:border-border2');
  });

  it('uses the shared text rhythm for compact sizes', () => {
    render(<Searchbar size="xs" label="Search" placeholder="Search..." onSearch={() => {}} />);

    const inputClass = screen.getByPlaceholderText('Search...').className;
    expect(inputClass).toContain('h-form-xs');
    expect(inputClass).toContain('text-ui-xs');
    expect(inputClass).not.toContain('text-ui-md');
  });
});
