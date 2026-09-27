// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Search } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarNewMeter } from './sidebar-new-meter';
import { SidebarNew } from '.';

afterEach(() => cleanup());

describe('SidebarNewMeter', () => {
  it('exposes the tone and keeps grain to the neutral tone', () => {
    const { container } = render(
      <SidebarNewMeter label="Credits" value="$4" status="Credits are low" tone="warning" />,
    );

    const card = container.querySelector('[data-slot="sidebar-new-meter"]');
    expect(card?.getAttribute('data-tone')).toBe('warning');

    const bloom = container.querySelector<HTMLElement>('[data-slot="sidebar-new-meter-bloom"]');
    expect(bloom?.querySelector('span')).toBeNull();
  });

  it('keeps one card height across tones', () => {
    const { container: neutral } = render(<SidebarNewMeter label="Credits" value="$26" />);
    const neutralHeight = neutral.querySelector<HTMLElement>('[data-slot="sidebar-new-meter"]')?.style.height;

    cleanup();

    const { container: danger } = render(
      <SidebarNewMeter label="Credits" value="$0" status="Out of credits" tone="danger" />,
    );
    const dangerHeight = danger.querySelector<HTMLElement>('[data-slot="sidebar-new-meter"]')?.style.height;

    expect(neutralHeight).toBe(dangerHeight);
  });

  it('drops the label and covers the card with the link when collapsed', () => {
    render(
      <SidebarNewMeter
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
      <SidebarNewMeter
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

describe('SidebarNew command header', () => {
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
      <SidebarNew.Provider storageKey="sidebar-new-command-header-test">
        <SidebarNew>
          <SidebarNew.CommandHeader>
            <SidebarNew.Brand title="Mastra" />
            <SidebarNew.SearchTrigger aria-label="Search" shortcut="⌘ K" onClick={onSearch}>
              <Search />
            </SidebarNew.SearchTrigger>
          </SidebarNew.CommandHeader>
          <SidebarNew.Nav>Navigation</SidebarNew.Nav>
          <SidebarNew.Footer>
            <SidebarNew.FooterMeta action={<SidebarNew.Trigger />}>Mastra v0.24.6</SidebarNew.FooterMeta>
          </SidebarNew.Footer>
        </SidebarNew>
      </SidebarNew.Provider>,
    );
  }

  it('renders the optional search trigger and footer metadata', () => {
    const { container } = renderCommandHeader();

    expect(container.querySelector('[data-slot="sidebar-new-search-trigger"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="sidebar-new-footer-meta"]')).not.toBeNull();
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
      <SidebarNew.Provider storageKey="sidebar-new-command-header-without-search-test">
        <SidebarNew>
          <SidebarNew.CommandHeader>
            <SidebarNew.Brand title="Mastra" />
          </SidebarNew.CommandHeader>
          <SidebarNew.Footer>
            <SidebarNew.FooterMeta action={<SidebarNew.Trigger />}>Mastra v0.24.6</SidebarNew.FooterMeta>
          </SidebarNew.Footer>
        </SidebarNew>
      </SidebarNew.Provider>,
    );

    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Toggle sidebar' })).toBeDefined();
  });
});
