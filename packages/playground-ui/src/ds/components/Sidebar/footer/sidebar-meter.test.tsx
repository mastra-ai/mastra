// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Search } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '..';
import { SidebarMeter } from './sidebar-meter';

afterEach(() => cleanup());

describe('SidebarMeter', () => {
  it('exposes the tone and keeps grain to the neutral tone', () => {
    const { container } = render(<SidebarMeter label="Credits" value="$4" status="Credits are low" tone="warning" />);

    const card = container.querySelector('[data-slot="sidebar-meter"]');
    expect(card?.getAttribute('data-tone')).toBe('warning');

    const bloom = container.querySelector<HTMLElement>('[data-slot="sidebar-meter-bloom"]');
    expect(bloom?.querySelector('span')).toBeNull();
  });

  it('folds the label away and covers the card with the link when collapsed', () => {
    render(
      <SidebarMeter
        label="Credits"
        value="$4"
        status="Credits are low"
        tone="warning"
        state="collapsed"
        href="/billing"
        linkLabel="Credit balance"
        action={<button type="button">What are credits?</button>}
      />,
    );
    // Folded away, the action can't be reached with the keyboard either.
    expect(screen.getByRole('button', { name: 'What are credits?', hidden: true }).closest('[inert]')).not.toBeNull();

    // The label and its action stay in the card so the collapse can fold them away, out of reach meanwhile.
    expect(screen.getByText('Credits').closest('[inert]')).not.toBeNull();
    expect(screen.getByLabelText('Credit balance').getAttribute('href')).toBe('/billing');
  });

  it('keeps the full amount beside the rail amount, for the stylesheet to pick by state', () => {
    render(<SidebarMeter label="Credits" value="$6,649.10" railValue="$7K" state="collapsed" />);

    expect(screen.getByText('$6,649.10').hasAttribute('data-meter-full')).toBe(true);
    expect(screen.getByText('$7K').hasAttribute('data-meter-rail')).toBe(true);
  });

  it('renders the action outside the card link', () => {
    const { container } = render(
      <SidebarMeter
        label="Credits"
        value="$26"
        href="/billing"
        linkLabel="Credit balance"
        action={<button type="button">What are credits?</button>}
      />,
    );

    const link = container.querySelector('a[aria-label="Credit balance"]');
    expect(link).not.toBeNull();
    expect(link?.querySelector('button')).toBeNull();
    expect(screen.getByRole('button', { name: 'What are credits?' })).toBeDefined();
  });
});

describe('Sidebar command header', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: false,
        media: '',
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return true;
        },
      }),
    });
  });

  function renderCommandHeader(onSearch = vi.fn()) {
    return render(
      <Sidebar.Provider storageKey="sidebar-command-header-test">
        <Sidebar>
          <Sidebar.CommandHeader>
            <Sidebar.Brand title="Mastra" />
            <Sidebar.SearchTrigger aria-label="Search" shortcut="⌘ K" onClick={onSearch}>
              <Search />
            </Sidebar.SearchTrigger>
          </Sidebar.CommandHeader>
          <Sidebar.Nav>Navigation</Sidebar.Nav>
          <Sidebar.Footer>
            <Sidebar.FooterMeta action={<Sidebar.Trigger />}>Mastra v0.24.6</Sidebar.FooterMeta>
          </Sidebar.Footer>
        </Sidebar>
      </Sidebar.Provider>,
    );
  }

  it('renders the optional search trigger and footer metadata', () => {
    const { container } = renderCommandHeader();

    expect(container.querySelector('[data-slot="sidebar-search-trigger"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="sidebar-footer-meta"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Search' })).toBeDefined();
    expect(screen.getByText('Mastra')).toBeDefined();
    // The shortcut lives in the tooltip, not next to the icon
    expect(screen.queryByText('⌘ K')).toBeNull();
    expect(screen.getByText('Mastra v0.24.6')).toBeDefined();
  });

  it('forwards search interactions', () => {
    const onSearch = vi.fn();
    renderCommandHeader(onSearch);

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('supports a command header without search', () => {
    render(
      <Sidebar.Provider storageKey="sidebar-command-header-without-search-test">
        <Sidebar>
          <Sidebar.CommandHeader>
            <Sidebar.Brand title="Mastra" />
          </Sidebar.CommandHeader>
          <Sidebar.Footer>
            <Sidebar.FooterMeta action={<Sidebar.Trigger />}>Mastra v0.24.6</Sidebar.FooterMeta>
          </Sidebar.Footer>
        </Sidebar>
      </Sidebar.Provider>,
    );

    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toBeDefined();
  });
});
