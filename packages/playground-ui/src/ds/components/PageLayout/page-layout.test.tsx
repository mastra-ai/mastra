// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageLayout } from './index';

afterEach(cleanup);

describe('PageLayout', () => {
  describe('when breadcrumbs and header actions are provided', () => {
    it('renders them inside a header above the main content', () => {
      render(
        <PageLayout variant="page" breadcrumbs={<span>Crumbs</span>} headerActions={<button>Act</button>}>
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
        <PageLayout variant="page" breadcrumbs={<span>Crumbs</span>} actionRow={<input aria-label="Filter" />}>
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

  describe('scroll area', () => {
    it.each([undefined, <h1 key="title">Title</h1>])(
      'scrolls the body in an overlay scroll area with no reserved gutter',
      header => {
        render(
          <PageLayout variant="page" header={header}>
            <p>Body</p>
          </PageLayout>,
        );

        const area = screen.getByRole('main').firstElementChild;
        expect(area?.className).toContain('group/scroll-area');
        expect(screen.getByRole('main').outerHTML).not.toContain('scrollbar-gutter');
        expect(screen.getByText('Body').closest<HTMLElement>('[style*="overflow"]')?.style.overflowY).toBe('scroll');
      },
    );
  });

  describe('when a header is provided', () => {
    it('renders it inside main before the body', () => {
      render(
        <PageLayout variant="page" header={<h1>Title</h1>}>
          <p>Body</p>
        </PageLayout>,
      );

      const main = screen.getByRole('main');
      const heading = screen.getByRole('heading', { name: 'Title' });
      const body = screen.getByText('Body');
      expect(main.contains(heading)).toBe(true);
      expect(main.contains(body)).toBe(true);
      expect(heading.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('fixed body', () => {
    it.each([undefined, <h1 key="title">Title</h1>])(
      'sits beside the header in the scrolling body, so the frame can hand it the remaining height',
      header => {
        render(
          <PageLayout variant="page" body="fixed" header={header}>
            <p>Panels</p>
          </PageLayout>,
        );

        const fixedBody = screen.getByText('Panels').closest('[data-slot="page-layout-fixed"]');
        const viewport = screen.getByText('Panels').closest<HTMLElement>('[style*="overflow"]');
        expect(fixedBody).not.toBeNull();
        expect(fixedBody?.parentElement?.parentElement).toBe(viewport);
        if (header) {
          expect(fixedBody?.previousElementSibling?.getAttribute('data-slot')).toBe('page-layout-header');
        }
      },
    );
  });

  describe('when neither breadcrumbs nor header actions are provided', () => {
    it('does not render a header', () => {
      render(
        <PageLayout variant="page">
          <p>Body</p>
        </PageLayout>,
      );

      expect(screen.queryByRole('banner')).toBeNull();
      expect(screen.getByRole('main').textContent).toBe('Body');
    });
  });
});
