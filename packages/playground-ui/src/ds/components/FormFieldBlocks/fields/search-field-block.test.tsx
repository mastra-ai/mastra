// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SearchFieldBlock } from './search-field-block';

afterEach(() => {
  cleanup();
});

describe('SearchFieldBlock', () => {
  it('removes a vertically hidden label from the layout flow', () => {
    render(<SearchFieldBlock name="search" label="Search" labelIsHidden />);

    const label = screen.getByText('Search');

    expect(label.tagName).toBe('LABEL');
    expect(label.classList.contains('sr-only')).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Search' }).id).toBe('input-search');
  });

  it('hides the horizontal label column while preserving the accessible name', () => {
    const { container } = render(<SearchFieldBlock name="search" label="Search" labelIsHidden layout="horizontal" />);

    const [labelColumn, inputColumn] = container.firstElementChild?.children ?? [];

    expect(labelColumn?.classList.contains('sr-only')).toBe(true);
    expect(inputColumn?.classList.contains('col-span-full')).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Search' }).id).toBe('input-search');
  });

  it('keeps a visible horizontal label in a separate column', () => {
    const { container } = render(<SearchFieldBlock name="search" label="Search" layout="horizontal" />);

    const [labelColumn, inputColumn] = container.firstElementChild?.children ?? [];

    expect(labelColumn?.classList.contains('sr-only')).toBe(false);
    expect(inputColumn?.classList.contains('col-span-full')).toBe(false);
  });
});
