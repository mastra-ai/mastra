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
            visibilityStorageKey={storageKey}
            isActive={link => link.url === activeUrl}
          />
        </SidebarNew.Nav>
      </SidebarNew>
    </SidebarNew.Provider>,
  );
}

async function customizeSidebar(name = 'Tools') {
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Customize sidebar' }));
  return screen.findByRole('menuitemcheckbox', { name });
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

  it('saves show and hide choices across remounts', async () => {
    const first = renderSections();
    fireEvent.click(await customizeSidebar());
    expect(await screen.findByRole('link', { name: 'Tools' })).toBeTruthy();
    first.unmount();
    const second = renderSections();
    expect(screen.getByRole('link', { name: 'Tools' })).toBeTruthy();
    const checkbox = await customizeSidebar();
    expect(checkbox.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(checkbox);
    expect(screen.queryByRole('link', { name: 'Tools' })).toBeNull();
    second.unmount();
    renderSections();
    expect(screen.queryByRole('link', { name: 'Tools' })).toBeNull();
  });

  it('keeps More once every optional link is shown, so they can be hidden again', async () => {
    const first = renderSections();
    fireEvent.click(await customizeSidebar('Tools'));
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Workspaces' }));
    expect(await screen.findByRole('link', { name: 'Workspaces' })).toBeTruthy();
    first.unmount();
    renderSections();
    expect(screen.getByRole('link', { name: 'Tools' })).toBeTruthy();
    fireEvent.click(await customizeSidebar('Workspaces'));
    expect(screen.queryByRole('link', { name: 'Workspaces' })).toBeNull();
  });

  it('shows a hidden link in place while its route is current, without saving it', async () => {
    const first = renderSections(sections, '/tools');
    const navigation = screen.getByRole('navigation', { name: 'Main' });
    expect(within(navigation).getByRole('link', { name: 'Tools' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: 'Workspaces' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Tools' })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Customize sidebar' }));
    expect((await screen.findByRole('menuitemcheckbox', { name: 'Tools' })).getAttribute('aria-checked')).toBe('false');
    first.unmount();
    renderSections();
    expect(screen.queryByRole('link', { name: 'Tools' })).toBeNull();
  });

  it('does not pin a hidden link just because it was visited', async () => {
    const first = renderSections();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Tools' }));
    first.unmount();
    renderSections();
    expect(screen.queryByRole('link', { name: 'Tools' })).toBeNull();
  });

  it('shows a single optional link without a More row until it is hidden', () => {
    const single: SidebarNewSection[] = [
      { key: 'infrastructure', links: [], moreLinks: [{ name: 'Workspaces', url: '/workspaces' }] },
    ];
    const first = renderSections(single);
    expect(screen.getByRole('link', { name: 'Workspaces' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    first.unmount();
    localStorage.setItem(storageKey, JSON.stringify({ 'infrastructure:Workspaces': false }));
    renderSections(single);
    expect(screen.queryByRole('link', { name: 'Workspaces' })).toBeNull();
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
  });

  it('keeps a choice when the link URL changes between projects', async () => {
    const inProject = (projectId: string): SidebarNewSection[] => [
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
    fireEvent.click(await customizeSidebar());
    expect(await screen.findByRole('link', { name: 'Tools' })).toBeTruthy();
    first.unmount();
    renderSections(inProject('b'));
    expect(screen.getByRole('link', { name: 'Tools' }).getAttribute('href')).toBe('/projects/b/tools');
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
