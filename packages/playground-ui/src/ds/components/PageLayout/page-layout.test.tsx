// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageLayout } from './index';

afterEach(cleanup);

describe('PageLayout', () => {
  describe('when breadcrumbs and actions are provided', () => {
    it('renders them inside a header above the main content', () => {
      render(
        <PageLayout breadcrumbs={<span>Crumbs</span>} actions={<button>Act</button>}>
          <p>Body</p>
        </PageLayout>,
      );

      const header = screen.getByRole('banner');
      expect(header.textContent).toContain('Crumbs');
      expect(header.contains(screen.getByRole('button', { name: 'Act' }))).toBe(true);
      expect(header.compareDocumentPosition(screen.getByRole('main')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('when neither breadcrumbs nor actions are provided', () => {
    it('does not render a header', () => {
      render(
        <PageLayout>
          <p>Body</p>
        </PageLayout>,
      );

      expect(screen.queryByRole('banner')).toBeNull();
      expect(screen.getByRole('main').textContent).toBe('Body');
    });
  });
});
