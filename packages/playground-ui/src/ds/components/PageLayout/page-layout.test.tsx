// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageLayout } from './index';

afterEach(cleanup);

describe('PageLayout', () => {
  describe('when breadcrumbs and header actions are provided', () => {
    it('renders them inside a header above the main content', () => {
      render(
        <PageLayout breadcrumbs={<span>Crumbs</span>} headerActions={<button>Act</button>}>
          <p>Body</p>
        </PageLayout>,
      );

      const header = screen.getByRole('banner');
      expect(header.textContent).toContain('Crumbs');
      expect(header.contains(screen.getByRole('button', { name: 'Act' }))).toBe(true);
      expect(header.compareDocumentPosition(screen.getByRole('main')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('when an action row is provided', () => {
    it('pins it between the header and the scrollable body', () => {
      render(
        <PageLayout breadcrumbs={<span>Crumbs</span>} actionRow={<input aria-label="Filter" />}>
          <p>Body</p>
        </PageLayout>,
      );

      const row = screen.getByLabelText('Filter').closest('[data-slot="page-layout-action-row"]');
      const main = screen.getByRole('main');
      expect(row).not.toBeNull();
      if (!row) return;
      expect(main.contains(row)).toBe(false);
      expect(screen.getByRole('banner').compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(row.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('variant', () => {
    it('pads the body by default and removes padding with "fit"', () => {
      const { rerender } = render(
        <PageLayout>
          <p>Body</p>
        </PageLayout>,
      );
      expect(screen.getByRole('main').className).toContain('p-4');

      rerender(
        <PageLayout variant="fit">
          <p>Body</p>
        </PageLayout>,
      );
      expect(screen.getByRole('main').className).not.toContain('p-4');
    });
  });

  describe('when neither breadcrumbs nor header actions are provided', () => {
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
