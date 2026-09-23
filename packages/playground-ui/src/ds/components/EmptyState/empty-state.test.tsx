// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  afterEach(cleanup);

  describe('when variant is not set', () => {
    it('renders the block in place without a fill wrapper', () => {
      render(<EmptyState iconSlot={null} titleSlot="Nothing here" />);
      expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeTruthy();
      expect(document.querySelector('[data-slot="empty-state-fill"]')).toBeNull();
    });
  });

  describe('when variant is fill', () => {
    it('wraps the block in a full-height centered container', () => {
      render(<EmptyState iconSlot={null} titleSlot="Nothing here" variant="fill" />);
      const wrapper = document.querySelector('[data-slot="empty-state-fill"]');
      expect(wrapper?.className).toContain('h-full');
      expect(wrapper?.className).toContain('items-center-safe');
      expect(wrapper?.className).toContain('justify-center-safe');
      expect(wrapper?.contains(screen.getByRole('heading', { name: 'Nothing here' }))).toBe(true);
    });
  });
});
