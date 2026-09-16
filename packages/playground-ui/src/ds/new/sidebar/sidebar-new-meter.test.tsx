// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SidebarNewMeter } from './sidebar-new-meter';
import { SidebarNew } from '.';

afterEach(() => cleanup());

describe('SidebarNewMeter', () => {
  it('renders neutral content with semantic color classes', () => {
    const { container } = render(<SidebarNewMeter label="Credits" value="$26" status="Auto top-ups On" />);

    const card = container.querySelector('[data-slot="sidebar-new-meter"]');
    expect(card?.className).toContain('border-border');
    expect(card?.className).toContain('bg-background');
    expect(screen.getByText('Credits').className).toContain('text-muted-foreground');
    expect(screen.getByText('$26').className).toContain('text-foreground');
    expect(screen.getByText('Auto top-ups On').className).toContain('text-muted-foreground');

    const bloom = container.querySelector<HTMLElement>('[data-slot="sidebar-new-meter-bloom"]');
    expect(bloom?.style.backgroundImage).toContain('var(--foreground)');
  });

  it('exposes the tone and keeps grain to the neutral tone', () => {
    const { container } = render(
      <SidebarNewMeter label="Credits" value="$4" status="Credits are low" tone="warning" />,
    );

    const card = container.querySelector('[data-slot="sidebar-new-meter"]');
    expect(card?.getAttribute('data-tone')).toBe('warning');
    expect(screen.getByText('Credits are low').className).toContain('text-notice-warning-fg');

    const bloom = container.querySelector<HTMLElement>('[data-slot="sidebar-new-meter-bloom"]');
    expect(bloom?.querySelector('span')).toBeNull();
    expect(bloom?.style.backgroundImage).toContain('var(--notice-warning)');
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
    const { container } = render(
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
    expect(screen.getByText('$4').className).toContain('text-foreground');
    expect(screen.getByLabelText('Credit balance').getAttribute('href')).toBe('/billing');
    const card = container.querySelector('[data-state="collapsed"]');
    expect(card?.className).toContain('border-border');
    expect(card?.className).toContain('bg-background');
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
    expect(link?.parentElement?.className).toContain('hover:bg-card');
    expect(screen.getByRole('button', { name: 'What are credits?' })).toBeDefined();
  });
});

describe('SidebarNew colors', () => {
  it('uses semantic colors for the shell, brand, headings, divider, and stack controls', () => {
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

    const { container } = render(
      <SidebarNew.Provider storageKey="sidebar-new-colors-test">
        <SidebarNew>
          <SidebarNew.Header>
            <SidebarNew.Brand title="Mastra" />
          </SidebarNew.Header>
          <SidebarNew.Nav>
            <SidebarNew.NavHeader>Project</SidebarNew.NavHeader>
            <SidebarNew.NavHeader state="collapsed">Collapsed section</SidebarNew.NavHeader>
            <SidebarNew.NavStack value="settings" onValueChange={() => undefined}>
              <SidebarNew.NavStack.Root>Main navigation</SidebarNew.NavStack.Root>
              <SidebarNew.NavStack.View value="settings" title="Settings">
                Settings navigation
              </SidebarNew.NavStack.View>
            </SidebarNew.NavStack>
          </SidebarNew.Nav>
        </SidebarNew>
      </SidebarNew.Provider>,
    );

    const sidebar = container.querySelector('aside[aria-label="Sidebar"] > div');
    expect(sidebar?.className).toContain('sidebar-new-theme');
    expect(sidebar?.className).toContain('bg-sidebar');
    expect(sidebar?.className).toContain('text-foreground');
    expect(sidebar?.className).not.toContain('[--');
    expect(screen.getByText('Mastra').className).toContain('text-foreground');
    expect(screen.getByText('Project').className).toContain('text-muted-foreground');
    expect(
      [...container.querySelectorAll<HTMLElement>('[class]')].some(element => element.className.includes('bg-border')),
    ).toBe(true);

    const back = screen.getByRole('button', { name: 'Back to main navigation: Settings' });
    expect(back.className).toContain('text-muted-foreground');
    expect(back.className).toContain('hover:text-foreground');
  });
});
