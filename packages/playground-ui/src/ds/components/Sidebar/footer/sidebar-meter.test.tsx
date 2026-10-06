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

  it('keeps one card height across tones', () => {
    const { container: neutral } = render(<SidebarMeter label="Credits" value="$26" />);
    const neutralHeight = neutral.querySelector<HTMLElement>('[data-slot="sidebar-meter"]')?.style.height;

    cleanup();

    const { container: danger } = render(
      <SidebarMeter label="Credits" value="$0" status="Out of credits" tone="danger" />,
    );
    const dangerHeight = danger.querySelector<HTMLElement>('[data-slot="sidebar-meter"]')?.style.height;

    expect(neutralHeight).toBe(dangerHeight);
  });

  it('drops the label and covers the card with the link when collapsed', () => {
    render(
      <SidebarMeter
        label="Credits"
        value="$4"
        status="Credits are low"
        tone="warning"
        state="collapsed"
        href="/billing"
        linkLabel="Credit balance"
      />,
    );

    expect(screen.queryByText('Credits')).toBeNull();
    expect(screen.getByLabelText('Credit balance').getAttribute('href')).toBe('/billing');
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
    expect(screen.getByText('⌘ K')).toBeDefined();
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
