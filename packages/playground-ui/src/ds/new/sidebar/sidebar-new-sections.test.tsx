// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarNew } from './sidebar-new';
import type { SidebarNewSection } from './sidebar-new-sections';
import type { LinkComponentProps } from '@/ds/types/link-component';

const storageKey = 'sidebar-visibility-test';
const sections: SidebarNewSection[] = [
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

function renderSections(items = sections, activeUrl = '/agents') {
  return render(
    <SidebarNew.Provider LinkComponent={TestLink}>
      <SidebarNew>
        <SidebarNew.Nav aria-label="Main">
          <SidebarNew.Sections
            sections={items}
            recentItemsStorageKey={storageKey}
            isActive={link => link.url === activeUrl}
          />
        </SidebarNew.Nav>
      </SidebarNew>
    </SidebarNew.Provider>,
  );
}

async function customizeSidebar() {
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Customize sidebar' }));
  return screen.findByRole('menuitemcheckbox', { name: 'Tools' });
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SidebarNew.Sections', () => {
  it('opens hidden links in a floating menu and returns focus on Escape', async () => {
    renderSections();
    const navigation = screen.getByRole('navigation', { name: 'Main' });
    const more = screen.getByRole('button', { name: 'More' });
    fireEvent.click(more);
    const tools = await screen.findByRole('menuitem', { name: 'Tools' });
    expect(tools.getAttribute('href')).toBe('/tools');
    expect(within(navigation).queryByRole('link', { name: 'Tools' })).toBeNull();
    fireEvent.keyDown(tools, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(more));
  });

  it('saves show and hide choices across remounts, including the active route', async () => {
    const first = renderSections();
    fireEvent.click(await customizeSidebar());
    expect(await screen.findByRole('link', { name: 'Tools' })).toBeTruthy();
    first.unmount();
    const second = renderSections(sections, '/tools');
    expect(screen.getByRole('link', { name: 'Tools' })).toBeTruthy();
    const checkbox = await customizeSidebar();
    expect(checkbox.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(checkbox);
    expect(screen.queryByRole('link', { name: 'Tools' })).toBeNull();
    second.unmount();
    renderSections(sections, '/tools');
    expect(screen.queryByRole('link', { name: 'Tools' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect((await screen.findByRole('menuitem', { name: 'Tools' })).getAttribute('aria-current')).toBe('page');
  });

  it('does not pin a hidden link just because it was visited', async () => {
    const first = renderSections();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Tools' }));
    first.unmount();
    renderSections();
    expect(screen.queryByRole('link', { name: 'Tools' })).toBeNull();
  });

  it('preserves the visible default for a single optional Platform link', () => {
    renderSections([{ key: 'infrastructure', links: [], moreLinks: [{ name: 'Workspaces', url: '/workspaces' }] }]);
    expect(screen.getByRole('link', { name: 'Workspaces' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
  });

  it('recovers from invalid stored preferences', async () => {
    localStorage.setItem(storageKey, '{broken');
    renderSections();
    fireEvent.click(await customizeSidebar());
    expect(await screen.findByRole('link', { name: 'Tools' })).toBeTruthy();
  });

  it('keeps customization usable when browser storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    renderSections();
    fireEvent.click(await customizeSidebar());
    expect(await screen.findByRole('link', { name: 'Tools' })).toBeTruthy();
  });

  it('preserves unexpired legacy visibility and discards expired visits', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        '/tools:Tools': Date.now(),
        '/workspaces:Workspaces': Date.now() - 8 * 24 * 60 * 60 * 1000,
      }),
    );
    renderSections();
    expect(screen.getByRole('link', { name: 'Tools' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Workspaces' })).toBeNull();
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
