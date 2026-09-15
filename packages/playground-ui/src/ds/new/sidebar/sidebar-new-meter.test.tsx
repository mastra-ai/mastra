// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SidebarNewMeter } from './sidebar-new-meter';

afterEach(() => cleanup());

describe('SidebarNewMeter', () => {
  it('renders the label, value, and status', () => {
    render(<SidebarNewMeter label="Credits" value="$26" status="Auto top-ups On" />);

    expect(screen.getByText('Credits')).toBeDefined();
    expect(screen.getByText('$26')).toBeDefined();
    expect(screen.getByText('Auto top-ups On')).toBeDefined();
  });

  it('exposes the tone and keeps grain to the neutral tone', () => {
    const { container } = render(
      <SidebarNewMeter label="Credits" value="$4" status="Credits are low" tone="warning" />,
    );

    const card = container.querySelector('[data-slot="sidebar-new-meter"]');
    expect(card?.getAttribute('data-tone')).toBe('warning');

    const bloom = container.querySelector('[data-slot="sidebar-new-meter-bloom"]');
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
    expect(screen.getByText('$4')).toBeDefined();
    expect(screen.getByLabelText('Credit balance').getAttribute('href')).toBe('/billing');
    expect(container.querySelector('[data-state="collapsed"]')).not.toBeNull();
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
