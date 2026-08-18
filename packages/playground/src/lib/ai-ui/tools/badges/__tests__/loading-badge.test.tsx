// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LoadingBadge } from '../loading-badge';

afterEach(() => cleanup());

describe('LoadingBadge', () => {
  describe('when an entity is loading', () => {
    it('renders a non-interactive shared tool row', () => {
      render(<LoadingBadge />);

      const badge = screen.getByRole('group', { name: 'Loading tool call' });
      expect(badge.getAttribute('aria-busy')).toBe('true');
      expect(within(badge).queryByRole('button')).toBeNull();
    });
  });
});
