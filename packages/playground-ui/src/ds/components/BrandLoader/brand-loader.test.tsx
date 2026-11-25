// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BrandLoader } from './brand-loader';

afterEach(cleanup);

describe('BrandLoader', () => {
  it('stays inline without fill', () => {
    const { container } = render(<BrandLoader aria-label="Loading" />);

    expect(container.firstElementChild).toBe(screen.getByRole('status', { name: 'Loading' }));
  });

  it('wraps itself in the page area with fill', () => {
    const { container } = render(<BrandLoader fill aria-label="Loading page" />);

    const loader = screen.getByRole('status', { name: 'Loading page' });
    expect(container.firstElementChild?.getAttribute('data-slot')).toBe('brand-loader-fill');
    expect(container.firstElementChild?.contains(loader)).toBe(true);
  });
});
