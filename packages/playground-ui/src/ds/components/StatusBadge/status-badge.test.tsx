// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StatusBadge } from './StatusBadge';

afterEach(() => {
  cleanup();
});

describe('StatusBadge', () => {
  it('uses intrinsic width by default so grid cells do not stretch it', () => {
    render(<StatusBadge data-testid="status-badge">Running</StatusBadge>);

    const badge = screen.getByTestId('status-badge');
    expect(badge.classList.contains('inline-flex')).toBe(true);
    expect(badge.classList.contains('w-fit')).toBe(true);
    expect(badge.classList.contains('max-w-full')).toBe(true);
  });
});
