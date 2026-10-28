// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageLayout } from './index';

afterEach(cleanup);

const viewportOf = (text: string) => screen.getByText(text).closest<HTMLElement>('[style*="overflow"]');

const contentOf = (text: string) =>
  screen.getByText(text).closest('[data-slot="page-layout-container"]')?.parentElement ??
  screen.getByText(text).parentElement;

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

  describe('when the body holds a toolbar and a list', () => {
    it('scrolls them together, in order', () => {
      render(
        <PageLayout breadcrumbs={<span>Crumbs</span>}>
          <input aria-label="Filter" />
          <PageLayout.Fill>
            <p>Body</p>
          </PageLayout.Fill>
        </PageLayout>,
      );

      const filter = screen.getByLabelText('Filter');
      expect(filter.closest('[style*="overflow"]')).toBe(viewportOf('Body'));
      expect(filter.compareDocumentPosition(screen.getByText('Body')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('gives the list the height left under the toolbar', () => {
      render(
        <PageLayout>
          <PageLayout.Fill>
            <p>Body</p>
          </PageLayout.Fill>
        </PageLayout>,
      );

      const fill = screen.getByText('Body').closest('[data-slot="page-layout-fill"]');
      expect(fill?.className).toMatch(/\bgrow\b/);
      expect(fill?.className).toContain('basis-0');
      expect(fill?.className).toContain('min-h-0');
    });
  });

  describe('scroll area', () => {
    it.each(['container', 'fit', 'narrow'] as const)(
      'scrolls the "%s" variant in an overlay scroll area with no reserved gutter',
      variant => {
        render(
          <PageLayout variant={variant}>
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

  describe('mask', () => {
    const viewportOf = () => screen.getByText('Body').closest<HTMLElement>('[style*="overflow"]');

    it('does not fade the body edges by default', () => {
      render(
        <PageLayout>
          <p>Body</p>
        </PageLayout>,
      );

      expect(viewportOf()?.className).not.toContain('mask-');
    });

    it('fades the edges the caller asks for', () => {
      render(
        <PageLayout mask={{ y: true }}>
          <p>Body</p>
        </PageLayout>,
      );

      expect(viewportOf()?.className).toContain('mask-b-from');
    });
  });

  describe('variant', () => {
    it('pads the body by default and removes padding with "fit"', () => {
      const { rerender } = render(
        <PageLayout>
          <p>Body</p>
        </PageLayout>,
      );
      expect(viewportOf('Body')?.className).toContain('p-4');

      rerender(
        <PageLayout variant="fit">
          <p>Body</p>
        </PageLayout>,
      );
      expect(viewportOf('Body')?.className).not.toContain('p-4');
    });

    it('constrains the "fit" column to the page width', () => {
      render(
        <PageLayout variant="fit">
          <p>Body</p>
        </PageLayout>,
      );
      expect(contentOf('Body')?.className).toContain('grid-cols-1');
    });

    it.each(['container', 'narrow'] as const)('stacks the "%s" body with a gap', variant => {
      render(
        <PageLayout variant={variant}>
          <h1>Title</h1>
          <p>Body</p>
        </PageLayout>,
      );
      const stack = screen.getByText('Body').parentElement?.className ?? '';
      expect(stack).toContain('flex-col');
      expect(stack).toContain('gap-4');
    });
  });

  describe('narrow variant', () => {
    it('centers the body in a max-width padded container', () => {
      render(
        <PageLayout variant="narrow">
          <h1>Title</h1>
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
