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
});
