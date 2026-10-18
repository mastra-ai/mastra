// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { SessionExpired } from './session-expired';

const withClient = (children: ReactNode) => (
  <MastraReactProvider baseUrl="http://localhost:4111">{children}</MastraReactProvider>
);

describe('SessionExpired', () => {
  afterEach(cleanup);

  describe('when variant is not set', () => {
    it('renders in place without a fill wrapper', () => {
      render(withClient(<SessionExpired />));
      expect(screen.getByRole('heading', { name: 'Session Expired' })).toBeTruthy();
      expect(document.querySelector('[data-slot="empty-state-fill"]')).toBeNull();
    });
  });

  describe('when variant is fill', () => {
    it('wraps the block in a full-height centered container', () => {
      render(withClient(<SessionExpired variant="fill" />));
      const wrapper = document.querySelector('[data-slot="empty-state-fill"]');
      expect(wrapper?.className).toContain('h-full');
      expect(wrapper?.contains(screen.getByRole('heading', { name: 'Session Expired' }))).toBe(true);
    });
  });
});
