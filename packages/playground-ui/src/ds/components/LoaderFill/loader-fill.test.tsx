// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BrandLoader } from '../BrandLoader';

afterEach(cleanup);

describe('BrandLoader fill', () => {
  it('stays inline without fill', () => {
    render(<BrandLoader />);

    expect(screen.getByRole('status', { name: 'Loading' }).closest('[data-slot="loader-fill"]')).toBeNull();
  });

  it('wraps the loader in its area', () => {
    render(<BrandLoader fill aria-label="Loading page" />);

    const loader = screen.getByRole('status', { name: 'Loading page' });
    expect(loader.parentElement?.getAttribute('data-slot')).toBe('loader-fill');
  });
});
