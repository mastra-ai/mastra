// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Breadcrumb, Crumb } from '../Breadcrumb';
import { PageLayout } from './index';
import { AppShell, AppShellMobileHeader } from '@/ds/new/layout/app-shell';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setViewport(mobile: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    query =>
      ({
        matches: mobile,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

const CrumbLink = ({ to, ...props }: ComponentProps<'a'> & { to?: string }) => <a href={to} {...props} />;

const trail = (
  <Breadcrumb label="Breadcrumb">
    <Crumb as={CrumbLink} to="/workflows">
      Workflows
    </Crumb>
    <Crumb as={CrumbLink} to="/workflows/tick">
      tickWorkflow
    </Crumb>
    <Crumb as="span" isCurrent>
      run-123
    </Crumb>
  </Breadcrumb>
);

function renderInShell(page: ReactNode) {
  return render(
    <AppShell
      mobileHeader={<AppShellMobileHeader fallback={<span>Mastra Studio</span>} end={<button>Search</button>} />}
    >
      {page}
    </AppShell>,
  );
}

const mobileHeader = () => {
  const header = document.querySelector<HTMLElement>('[data-slot="app-shell-mobile-header"]');
  if (!header) throw new Error('mobile header not rendered');
  return header;
};

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

    it.each([undefined, <h1 key="title">Title</h1>])('constrains the "fit" column to the page width', header => {
      render(
        <PageLayout variant="fit" header={header}>
          <p>Body</p>
        </PageLayout>,
      );
      expect(screen.getByRole('main').className).toContain('grid-cols-1');
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

  describe('inside an AppShell with a mobile header', () => {
    describe('below lg', () => {
      it('renders the breadcrumbs and actions in the mobile header instead of its own header row', () => {
        setViewport(true);
        renderInShell(
          <PageLayout breadcrumbs={trail} headerActions={<button>API endpoints</button>}>
            <p>Body</p>
          </PageLayout>,
        );

        const header = mobileHeader();
        expect(within(header).getByText('run-123')).toBeTruthy();
        expect(within(header).getByRole('button', { name: 'API endpoints' })).toBeTruthy();
        expect(screen.getAllByRole('banner')).toEqual([header]);
      });

      it('shows only the current crumb inline and the earlier ones behind a menu', () => {
        setViewport(true);
        renderInShell(
          <PageLayout breadcrumbs={trail}>
            <p>Body</p>
          </PageLayout>,
        );

        const header = mobileHeader();
        expect(within(header).getByText('Workflows').closest('li')?.className).toContain('hidden');
        expect(within(header).getByText('run-123').closest('li')?.className).not.toContain('hidden');

        fireEvent.click(within(header).getByRole('button', { name: 'Show breadcrumb trail' }));
        const menu = document.querySelector<HTMLElement>('[data-slot="popover-content"]');
        expect(menu).not.toBeNull();
        if (!menu) return;
        const crumbs = within(menu).getAllByRole('listitem');
        expect(crumbs.map(li => li.textContent)).toEqual(['Workflows', 'tickWorkflow', 'run-123']);
        expect(within(menu).queryByRole('separator')).toBeNull();
        expect(within(menu).getByRole('link', { name: 'tickWorkflow' }).getAttribute('href')).toBe('/workflows/tick');
      });

      it('keeps the app fallback for pages without breadcrumbs', () => {
        setViewport(true);
        renderInShell(
          <PageLayout>
            <p>Body</p>
          </PageLayout>,
        );

        const header = mobileHeader();
        expect(within(header).getByText('Mastra Studio')).toBeTruthy();
        expect(header.querySelector('[data-slot="page-layout-mobile-crumbs"]')).toBeNull();
      });
    });

    describe('at lg and up', () => {
      it('keeps the breadcrumbs in its own header row', () => {
        setViewport(false);
        renderInShell(
          <PageLayout breadcrumbs={trail}>
            <p>Body</p>
          </PageLayout>,
        );

        expect(within(mobileHeader()).queryByText('run-123')).toBeNull();
        const pageHeader = screen.getAllByRole('banner').find(el => el !== mobileHeader());
        expect(pageHeader && within(pageHeader).getByText('Workflows')).toBeTruthy();
      });
    });
  });

  describe('outside an AppShell below lg', () => {
    it('keeps the breadcrumbs in its own header row', () => {
      setViewport(true);
      render(
        <PageLayout breadcrumbs={trail}>
          <p>Body</p>
        </PageLayout>,
      );

      expect(within(screen.getByRole('banner')).getByText('Workflows').closest('li')?.className).not.toContain(
        'hidden',
      );
    });
  });
});
