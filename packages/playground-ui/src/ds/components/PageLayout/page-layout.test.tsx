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

  describe('when a header is provided', () => {
    it.each(['container', 'narrow', 'fit'] as const)('renders it inside main before the body (%s)', variant => {
      render(
        <PageLayout variant={variant} header={<h1>Title</h1>}>
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

  describe('narrow variant', () => {
    it('centers the header and body in a max-width padded container', () => {
      render(
        <PageLayout variant="narrow" header={<h1>Title</h1>}>
          <p>Body</p>
        </PageLayout>,
      );

      const container = screen.getByText('Body').closest('[data-slot="page-layout-container"]');
      expect(container).not.toBeNull();
      if (!container) return;
      expect(container.className).toContain('mx-auto');
      expect(container.className).toContain('max-w-5xl');
      expect(container.className).toContain('p-4');
      expect(container.contains(screen.getByRole('heading', { name: 'Title' }))).toBe(true);
      expect(screen.getByRole('main').className).not.toContain('p-4');
    });

    it('leaves spacing between header and body to the call site', () => {
      render(
        <PageLayout variant="narrow" header={<h1>Title</h1>}>
          <p>Body</p>
        </PageLayout>,
      );

      const container = screen.getByText('Body').closest('[data-slot="page-layout-container"]');
      expect(container?.className).not.toMatch(/\b(flex|gap-6)\b/);
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
