// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PermissionDenied } from './PermissionDenied';

describe('PermissionDenied', () => {
  afterEach(cleanup);

  describe('when variant is not set', () => {
    it('renders in place without a fill wrapper', () => {
      render(<PermissionDenied resource="agents" />);
      expect(screen.getByRole('heading', { name: 'Permission Denied' })).toBeTruthy();
      expect(document.querySelector('[data-slot="empty-state-fill"]')).toBeNull();
    });
  });

  describe('when variant is fill', () => {
    it('wraps the block in a full-height centered container', () => {
      render(<PermissionDenied resource="agents" variant="fill" />);
      const wrapper = document.querySelector('[data-slot="empty-state-fill"]');
      expect(wrapper?.className).toContain('h-full');
      expect(wrapper?.contains(screen.getByRole('heading', { name: 'Permission Denied' }))).toBe(true);
    });
  });
});
