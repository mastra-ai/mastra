// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  afterEach(cleanup);

  describe('when variant is not set', () => {
    it('renders title and message in place without a fill wrapper', () => {
      render(<ErrorState title="Failed to load" message="Boom" />);
      expect(screen.getByRole('heading', { name: 'Failed to load' })).toBeTruthy();
      expect(screen.getByText('Boom')).toBeTruthy();
      expect(document.querySelector('[data-slot="empty-state-fill"]')).toBeNull();
    });
  });

  describe('when variant is fill', () => {
    it('wraps the block in a full-height centered container', () => {
      render(<ErrorState title="Failed to load" message="Boom" variant="fill" />);
      const wrapper = document.querySelector('[data-slot="empty-state-fill"]');
      expect(wrapper?.className).toContain('h-full');
      expect(wrapper?.contains(screen.getByRole('heading', { name: 'Failed to load' }))).toBe(true);
    });
  });
});
