// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PageHeader } from '../page-header';
import { AppShell } from './app-shell';
import { MainCard } from './main-card';
import { Breadcrumb, Crumb } from '@/ds/components/Breadcrumb';
import { PageLayout } from '@/ds/components/PageLayout';
import { Sidebar, SidebarProvider, useSidebar } from '@/ds/components/Sidebar';

function mockMatchMedia(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function Shell({ children, mobileHeader }: { children: ReactNode; mobileHeader?: ReactNode }) {
  return (
    <SidebarProvider>
      <AppShell
        sidebar={
          <Sidebar aria-label="Sidebar">
            <Sidebar.Nav />
          </Sidebar>
        }
        mobileHeader={mobileHeader}
        mobileBrand={<Sidebar.Brand title="Mastra Projects" />}
        mobileActions={<button type="button">Search</button>}
      >
        <MainCard>{children}</MainCard>
      </AppShell>
    </SidebarProvider>
  );
}

function ShortcutProbe() {
  const { toggleSidebar } = useSidebar();
  return (
    <button type="button" onClick={toggleSidebar}>
      Shortcut
    </button>
  );
}

function RouterLink({ to, ...props }: ComponentProps<'a'> & { to?: string }) {
  return <a href={to} {...props} />;
}

const projectTrail = (
  <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
    <Crumb as={RouterLink} to="/projects/pltfrm-1389">
      PLTFRM-1389 browser automation sandbox
    </Crumb>
    <Crumb as="span" isCurrent>
      Overview
    </Crumb>
  </Breadcrumb>
);

const pageHeader = (
  <PageHeader>
    <PageHeader.Title>Billing</PageHeader.Title>
    <PageHeader.Description>Plan, credits and invoices for this organization.</PageHeader.Description>
  </PageHeader>
);

function pageBar() {
  const main = screen.getByRole('main');
  const bar = main.parentElement?.querySelector(':scope > header');
  if (!(bar instanceof HTMLElement)) throw new Error('The page renders no header row');
  return bar;
}

function rowButtons() {
  return within(pageBar())
    .getAllByRole('button')
    .filter(button => !button.closest('[data-breadcrumb-overflow]'))
    .map(button => button.getAttribute('aria-label') ?? button.textContent);
}

function deepTrail(openProject: () => void) {
  return (
    <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
      <Crumb
        as={RouterLink}
        to="/projects/pltfrm-1389"
        onClick={event => {
          event.preventDefault();
          openProject();
        }}
      >
        PLTFRM-1389 browser automation sandbox
      </Crumb>
      <Crumb as={RouterLink} to="/projects/pltfrm-1389/datasets">
        Datasets
      </Crumb>
      <Crumb as="span">Support conversations</Crumb>
      <Crumb as={RouterLink} to="/projects/pltfrm-1389/datasets/support/versions">
        Versions
      </Crumb>
      <Crumb as="span" isCurrent>
        Version 42
      </Crumb>
    </Breadcrumb>
  );
}

function shellRow() {
  const row = document.querySelector('[data-slot="app-shell-content"] > header');
  return row instanceof HTMLElement ? row : undefined;
}

beforeEach(() => mockMatchMedia(true));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AppShell mobile row', () => {
  describe('when the page has a breadcrumb trail', () => {
    it('puts the menu, the trail, the page actions, then the app actions on the page row', () => {
      render(
        <Shell>
          <PageLayout breadcrumbs={projectTrail} headerActions={<button type="button">Docs</button>}>
            <p>Body</p>
          </PageLayout>
        </Shell>,
      );

      const bar = within(pageBar());
      expect(bar.getByRole('link', { name: 'PLTFRM-1389 browser automation sandbox' })).toBeDefined();
      expect(bar.getByText('Overview').closest('[aria-current="page"]')).not.toBeNull();
      expect(rowButtons()).toEqual(['Open navigation menu', 'Docs', 'Search']);
      expect(bar.queryByText('Mastra Projects')).toBeNull();
    });

    it('renders one row with one menu button', () => {
      render(
        <Shell>
          <PageLayout breadcrumbs={projectTrail}>
            <p>Body</p>
          </PageLayout>
        </Shell>,
      );

      expect(shellRow()).toBeUndefined();
      expect(document.querySelectorAll('header:not(main header)')).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Open navigation menu' })).toHaveLength(1);
    });
  });

  describe('when the trail is deeper than the row shows', () => {
    it('lists the hidden levels behind the full path button, in order, as links', async () => {
      render(
        <Shell>
          <PageLayout breadcrumbs={deepTrail(vi.fn())}>
            <p>Body</p>
          </PageLayout>
        </Shell>,
      );

      await userEvent.click(within(pageBar()).getByRole('button', { name: 'Show the full path' }));

      const items = await screen.findAllByRole('menuitem');
      expect(items.map(item => item.textContent)).toEqual([
        'PLTFRM-1389 browser automation sandbox',
        'Datasets',
        'Support conversations',
      ]);
      expect(items[1]?.getAttribute('href')).toBe('/projects/pltfrm-1389/datasets');
      expect(items[2]?.getAttribute('aria-disabled')).toBe('true');
    });

    it('navigates through the hidden crumb’s own link', async () => {
      const openProject = vi.fn();
      render(
        <Shell>
          <PageLayout breadcrumbs={deepTrail(openProject)}>
            <p>Body</p>
          </PageLayout>
        </Shell>,
      );

      await userEvent.click(within(pageBar()).getByRole('button', { name: 'Show the full path' }));
      await userEvent.click(await screen.findByRole('menuitem', { name: 'PLTFRM-1389 browser automation sandbox' }));

      expect(openProject).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    });
  });

  describe('when the page has no trail', () => {
    it('keeps the brand on the row', () => {
      render(
        <Shell>
          <PageLayout>
            <p>Body</p>
          </PageLayout>
        </Shell>,
      );

      const bar = within(pageBar());
      expect(bar.getByText('Mastra Projects')).toBeDefined();
      expect(bar.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
      expect(bar.getAllByRole('button').map(button => button.getAttribute('aria-label') ?? button.textContent)).toEqual(
        ['Open navigation menu', 'Search'],
      );
    });
  });

  describe('when a PageLayout sits inside another', () => {
    it('gives only the outer page the menu and the app actions', () => {
      render(
        <Shell>
          <PageLayout breadcrumbs={projectTrail}>
            <PageLayout breadcrumbs={<span>Panel trail</span>}>
              <p>Panel body</p>
            </PageLayout>
          </PageLayout>
        </Shell>,
      );

      expect(screen.getAllByRole('button', { name: 'Open navigation menu' })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Search' })).toHaveLength(1);
      expect(screen.getByText('Panel trail')).toBeDefined();
    });
  });

  describe('when the page has a title and no trail', () => {
    it('shows the brand, since only breadcrumbs name the page on the row', () => {
      render(
        <Shell>
          <PageLayout variant="narrow" header={pageHeader}>
            <p>Body</p>
          </PageLayout>
        </Shell>,
      );

      expect(within(pageBar()).getByText('Mastra Projects')).toBeDefined();
      expect(screen.getAllByText('Billing')).toHaveLength(1);
    });
  });

  it('opens the navigation drawer from the page row and returns focus to it on close', async () => {
    render(
      <Shell>
        <PageLayout breadcrumbs={projectTrail}>
          <p>Body</p>
        </PageLayout>
      </Shell>,
    );

    const trigger = within(pageBar()).getByRole('button', { name: 'Open navigation menu' });
    fireEvent.click(trigger);
    const drawer = screen.getByRole('dialog', { name: 'Navigation' });
    fireEvent.keyDown(drawer, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('returns focus to the page row menu when the drawer opened without a click on it', async () => {
    render(
      <Shell>
        <PageLayout breadcrumbs={projectTrail}>
          <ShortcutProbe />
        </PageLayout>
      </Shell>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Shortcut' }));
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Navigation' }), { key: 'Escape' });

    const trigger = within(pageBar()).getByRole('button', { name: 'Open navigation menu' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  describe('when the consumer passes its own mobileHeader', () => {
    it('keeps that row and leaves the page row as it was', () => {
      render(
        <Shell mobileHeader={<header>Custom mobile header</header>}>
          <PageLayout breadcrumbs={projectTrail}>
            <p>Body</p>
          </PageLayout>
        </Shell>,
      );

      expect(screen.getByText('Custom mobile header')).toBeDefined();
      expect(within(pageBar()).queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
      expect(within(pageBar()).queryByRole('button', { name: 'Search' })).toBeNull();
    });
  });

  describe('on desktop', () => {
    beforeEach(() => mockMatchMedia(false));

    it('leaves the page row and the shell as they were', () => {
      render(
        <Shell>
          <PageLayout breadcrumbs={projectTrail} headerActions={<button type="button">Docs</button>}>
            <p>Body</p>
          </PageLayout>
        </Shell>,
      );

      expect(shellRow()).toBeUndefined();
      expect(
        within(pageBar())
          .getAllByRole('button')
          .map(button => button.textContent),
      ).toEqual(['Docs']);
      expect(screen.queryByText('Mastra Projects')).toBeNull();
      expect(screen.queryByLabelText('Open navigation menu')).toBeNull();
      expect(screen.queryByLabelText('Show the full path')).toBeNull();
    });

    it('renders no page row for a page with only a title', () => {
      render(
        <Shell>
          <PageLayout variant="narrow" header={pageHeader}>
            <p>Body</p>
          </PageLayout>
        </Shell>,
      );

      expect(document.querySelector('[data-slot="page-layout"] > header')).toBeNull();
      expect(shellRow()).toBeUndefined();
    });
  });

  describe('outside an AppShell', () => {
    it('renders no page row for a page with only a title', () => {
      render(
        <PageLayout variant="narrow" header={pageHeader}>
          <p>Body</p>
        </PageLayout>,
      );

      expect(document.querySelector('[data-slot="page-layout"] > header')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Open navigation menu' })).toBeNull();
    });
  });
});
