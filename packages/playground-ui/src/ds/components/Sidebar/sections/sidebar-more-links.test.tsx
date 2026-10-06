// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '../sidebar';
import type { SidebarSection } from './sidebar-sections';
import type { LinkComponentProps } from '@/ds/types/link-component';

const storageKey = 'sidebar-visibility-test';
const sections: SidebarSection[] = [
  {
    key: 'primitives',
    links: [{ name: 'Agents', url: '/agents' }],
    moreLinks: [
      { name: 'Tools', url: '/tools' },
      { name: 'Workspaces', url: '/workspaces' },
    ],
  },
];

function TestLink({ onClick, ...props }: LinkComponentProps) {
  return (
    <a
      {...props}
      onClick={event => {
        event.preventDefault();
        onClick?.(event);
      }}
    />
  );
}

function SectionsFixture({
  items = sections,
  activeUrl = '/agents',
  visibilityStorageKey = storageKey,
}: {
  items?: SidebarSection[];
  activeUrl?: string;
  visibilityStorageKey?: string;
}) {
  return (
    <Sidebar.Provider LinkComponent={TestLink}>
      <Sidebar>
        <Sidebar.Nav aria-label="Main">
          <Sidebar.Sections
            sections={items}
            visibilityStorageKey={visibilityStorageKey}
            isActive={link => link.url === activeUrl}
          />
        </Sidebar.Nav>
      </Sidebar>
    </Sidebar.Provider>
  );
}

function renderSections(items = sections, activeUrl = '/agents') {
  return render(<SectionsFixture items={items} activeUrl={activeUrl} />);
}

async function openCustomizeDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Customize sidebar' }));
  return screen.findByRole('dialog', { name: 'Customize sidebar' });
}

async function choosePlacement(name: string, placement: string) {
  const dialog = await openCustomizeDialog();
  fireEvent.click(within(dialog).getByRole('combobox', { name: `${name} placement` }));
  const option = await screen.findByRole('option', { name: placement });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
  await waitFor(() =>
    expect(within(dialog).getByRole('combobox', { name: `${name} placement` }).textContent).toContain(placement),
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

function navigation() {
  return within(screen.getByRole('navigation', { name: 'Main' }));
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Sidebar.Sections', () => {
  describe('when the visibility storage key changes', () => {
    it('loads the new scope and saves choices without changing the previous scope', async () => {
      const otherStorageKey = 'other-sidebar-visibility-test';
      localStorage.setItem(otherStorageKey, JSON.stringify({ 'primitives:Workspaces': 'sidebar' }));
      const view = renderSections();
      await choosePlacement('Tools', 'Always show');
      const firstScope = localStorage.getItem(storageKey);

      view.rerender(<SectionsFixture visibilityStorageKey={otherStorageKey} />);

      expect(navigation().queryByRole('link', { name: 'Tools' })).toBeNull();
      expect(navigation().getByRole('link', { name: 'Workspaces' })).toBeTruthy();
      await choosePlacement('Workspaces', 'Hide in More menu');
      expect(navigation().queryByRole('link', { name: 'Workspaces' })).toBeNull();
      await waitFor(() =>
        expect(localStorage.getItem(otherStorageKey)).toBe(JSON.stringify({ 'primitives:Workspaces': 'more' })),
      );
      expect(localStorage.getItem(storageKey)).toBe(firstScope);

      view.rerender(<SectionsFixture />);

      expect(navigation().getByRole('link', { name: 'Tools' })).toBeTruthy();
      expect(navigation().queryByRole('link', { name: 'Workspaces' })).toBeNull();
    });
  });

  it('opens hidden links in a floating menu and returns focus on Escape', async () => {
    renderSections();
    const more = screen.getByRole('button', { name: 'More' });
    fireEvent.click(more);
    const tools = await screen.findByRole('menuitem', { name: 'Tools' });
    expect(tools.getAttribute('href')).toBe('/tools');
    expect(navigation().queryByRole('link', { name: 'Tools' })).toBeNull();
    fireEvent.keyDown(tools, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(more));
  });

  it('returns focus to the right-clicked link when the Customize dialog closes', async () => {
    localStorage.setItem(storageKey, JSON.stringify({ 'primitives:Tools': 'sidebar' }));
    renderSections();
    const tools = navigation().getByRole('link', { name: 'Tools' });
    fireEvent.contextMenu(tools);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Customize sidebar…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Customize sidebar' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(tools));
  });

  it('saves each placement across remounts', async () => {
    const first = renderSections();
    await choosePlacement('Tools', 'Always show');
    expect(navigation().getByRole('link', { name: 'Tools' })).toBeTruthy();
    first.unmount();

    const second = renderSections();
    expect(navigation().getByRole('link', { name: 'Tools' })).toBeTruthy();
    await choosePlacement('Tools', 'Hide in More menu');
    expect(navigation().queryByRole('link', { name: 'Tools' })).toBeNull();
    second.unmount();

    renderSections();
    expect(navigation().queryByRole('link', { name: 'Tools' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: 'Tools' })).toBeTruthy();
  });

  it('removes a never-shown link from the sidebar and the More menu', async () => {
    renderSections();
    await choosePlacement('Tools', 'Never show');
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: 'Workspaces' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Tools' })).toBeNull();
    expect(navigation().queryByRole('link', { name: 'Tools' })).toBeNull();
  });

  it('still shows a never-shown link while its route is current', () => {
    localStorage.setItem(storageKey, JSON.stringify({ 'primitives:Tools': 'hidden' }));
    renderSections(sections, '/tools');
    expect(navigation().getByRole('link', { name: 'Tools' }).getAttribute('aria-current')).toBe('page');
  });

  it('changes a shown link placement from its right-click menu', async () => {
    localStorage.setItem(storageKey, JSON.stringify({ 'primitives:Tools': 'sidebar' }));
    renderSections();
    fireEvent.contextMenu(navigation().getByRole('link', { name: 'Tools' }));
    const hideInMore = await screen.findByRole('menuitemradio', { name: 'Hide in More menu' });
    expect(screen.getByRole('menuitemradio', { name: 'Always show' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(hideInMore);
    await waitFor(() => expect(navigation().queryByRole('link', { name: 'Tools' })).toBeNull());
    expect(localStorage.getItem(storageKey)).toBe(JSON.stringify({ 'primitives:Tools': 'more' }));
  });

  it('opens Customize sidebar from a right-click menu', async () => {
    localStorage.setItem(storageKey, JSON.stringify({ 'primitives:Tools': 'sidebar' }));
    renderSections();
    fireEvent.contextMenu(navigation().getByRole('link', { name: 'Tools' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Customize sidebar…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Customize sidebar' });
    expect(within(dialog).getByRole('combobox', { name: 'Tools placement' }).textContent).toContain('Always show');
  });

  it('keeps More once every optional link is shown, so they can be hidden again', async () => {
    const first = renderSections();
    await choosePlacement('Tools', 'Always show');
    await choosePlacement('Workspaces', 'Always show');
    expect(navigation().getByRole('link', { name: 'Workspaces' })).toBeTruthy();
    first.unmount();
    renderSections();
    expect(navigation().getByRole('link', { name: 'Tools' })).toBeTruthy();
    await choosePlacement('Workspaces', 'Hide in More menu');
    expect(navigation().queryByRole('link', { name: 'Workspaces' })).toBeNull();
  });

  it('keeps More when the active link and defaults leave nothing hidden', async () => {
    renderSections(
      [
        {
          key: 'primitives',
          links: [],
          moreLinks: [
            { name: 'MCP Servers', url: '/mcps', defaultVisible: true },
            { name: 'Tools', url: '/tools' },
            { name: 'Workspaces', url: '/workspaces', defaultVisible: true },
          ],
        },
      ],
      '/tools',
    );
    expect(navigation().getByRole('link', { name: 'Tools' }).getAttribute('aria-current')).toBe('page');
    await choosePlacement('MCP Servers', 'Hide in More menu');
    expect(navigation().queryByRole('link', { name: 'MCP Servers' })).toBeNull();
  });

  it('shows a hidden link in place while its route is current, without saving it', async () => {
    const first = renderSections(sections, '/tools');
    expect(navigation().getByRole('link', { name: 'Tools' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: 'Workspaces' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Tools' })).toBeNull();
    first.unmount();
    renderSections();
    expect(navigation().queryByRole('link', { name: 'Tools' })).toBeNull();
  });

  it('does not pin a hidden link just because it was visited', async () => {
    const first = renderSections();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Tools' }));
    first.unmount();
    renderSections();
    expect(navigation().queryByRole('link', { name: 'Tools' })).toBeNull();
  });

  it('shows a single optional link without a More row until it is hidden', () => {
    const single: SidebarSection[] = [
      { key: 'infrastructure', links: [], moreLinks: [{ name: 'Workspaces', url: '/workspaces' }] },
    ];
    const first = renderSections(single);
    expect(navigation().getByRole('link', { name: 'Workspaces' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    first.unmount();
    localStorage.setItem(storageKey, JSON.stringify({ 'infrastructure:Workspaces': 'more' }));
    renderSections(single);
    expect(navigation().queryByRole('link', { name: 'Workspaces' })).toBeNull();
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
  });

  it('keeps a choice when the link URL changes between projects', async () => {
    const inProject = (projectId: string): SidebarSection[] => [
      {
        key: 'primitives',
        links: [],
        moreLinks: [
          { name: 'Tools', url: `/projects/${projectId}/tools` },
          { name: 'Workspaces', url: `/projects/${projectId}/workspaces` },
        ],
      },
    ];
    const first = renderSections(inProject('a'));
    await choosePlacement('Tools', 'Always show');
    first.unmount();
    renderSections(inProject('b'));
    expect(navigation().getByRole('link', { name: 'Tools' }).getAttribute('href')).toBe('/projects/b/tools');
  });

  it('recovers from invalid stored preferences', async () => {
    localStorage.setItem(storageKey, '{broken');
    renderSections();
    await choosePlacement('Tools', 'Always show');
    expect(navigation().getByRole('link', { name: 'Tools' })).toBeTruthy();
  });

  it('keeps customization usable when browser storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    renderSections();
    await choosePlacement('Tools', 'Always show');
    expect(navigation().getByRole('link', { name: 'Tools' })).toBeTruthy();
  });

  it('keeps nested destinations reachable when their parent is hidden', async () => {
    renderSections([
      {
        key: 'nested',
        links: [],
        moreLinks: [
          {
            name: 'Tools',
            url: '/tools',
            defaultVisible: false,
            children: [{ name: 'Tool detail', url: '/tools/detail' }],
          },
        ],
      },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect((await screen.findByRole('menuitem', { name: 'Tool detail' })).getAttribute('href')).toBe('/tools/detail');
  });
});
