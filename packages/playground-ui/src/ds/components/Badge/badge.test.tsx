// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Badge } from './Badge';

afterEach(() => {
  cleanup();
});

describe('Badge', () => {
  it('uses intrinsic width by default so grid cells do not stretch it', () => {
    render(<Badge>Published</Badge>);

    const badge = screen.getByText('Published');
    expect(badge.classList.contains('inline-flex')).toBe(true);
    expect(badge.classList.contains('w-fit')).toBe(true);
    expect(badge.classList.contains('max-w-full')).toBe(true);
  });
});
