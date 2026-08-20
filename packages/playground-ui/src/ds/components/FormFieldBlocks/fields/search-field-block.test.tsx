// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SearchFieldBlock } from './search-field-block';

afterEach(() => {
  cleanup();
});

describe('SearchFieldBlock', () => {
  it.each(['vertical', 'horizontal'] as const)('removes a hidden label from the %s layout flow', layout => {
    render(<SearchFieldBlock name="search" label="Search" labelIsHidden layout={layout} />);

    const label = screen.getByText('Search');

    expect(label.tagName).toBe('LABEL');
    expect(label.classList.contains('sr-only')).toBe(true);
    expect(label.children).toHaveLength(0);
    expect((screen.getByLabelText('Search') as HTMLInputElement).id).toBe('input-search');
  });

  it('keeps a visible label in the layout flow', () => {
    render(<SearchFieldBlock name="search" label="Search" />);

    expect(screen.getByText('Search').classList.contains('sr-only')).toBe(false);
  });
});
