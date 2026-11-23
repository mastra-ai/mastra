// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BrandLoader } from '../BrandLoader';
import { Spinner } from '../Spinner';

afterEach(cleanup);

const fillOf = (name: string) => screen.getByRole('status', { name }).closest('[data-slot="loader-fill"]');

describe.each([
  ['BrandLoader', BrandLoader],
  ['Spinner', Spinner],
])('%s fill', (_name, Loader) => {
  it('stays inline without fill', () => {
    render(<Loader aria-label="Loading" />);

    expect(fillOf('Loading')).toBeNull();
  });

  it('fills a parent that has a height, and takes one in a parent that has none', () => {
    render(<Loader fill aria-label="Loading" />);

    const fill = fillOf('Loading');
    expect(fill?.classList.contains('h-full')).toBe(true);
    expect(fill?.classList.contains('min-h-32')).toBe(true);
  });

  it('covers the window with fill="screen"', () => {
    render(<Loader fill="screen" aria-label="Loading" />);

    expect(fillOf('Loading')?.classList.contains('h-dvh')).toBe(true);
  });
});
