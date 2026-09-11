// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LoadingBadge } from '../loading-badge';

afterEach(() => cleanup());

describe('LoadingBadge', () => {
  it('renders a non-collapsible placeholder badge with a spinner', () => {
    const { container } = render(<LoadingBadge />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('.spinner')).toBeTruthy();
  });
});
