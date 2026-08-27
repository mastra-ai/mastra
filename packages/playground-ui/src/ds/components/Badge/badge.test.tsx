// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Badge } from './Badge';
import type { BadgeSize, BadgeVariant } from './Badge';

const toneCases = [
  {
    variant: 'default',
    background: 'bg-surface4',
    mutedBackground: 'bg-neutral6/5',
    text: 'text-neutral5',
    mutedText: 'text-neutral3',
    indicator: 'bg-neutral3',
  },
  {
    variant: 'success',
    background: 'bg-notice-success/20',
    mutedBackground: 'bg-notice-success/10',
    text: 'text-notice-success-fg',
    mutedText: 'text-notice-success-fg',
    indicator: 'bg-accent1',
  },
  {
    variant: 'error',
    background: 'bg-notice-destructive/20',
    mutedBackground: 'bg-notice-destructive/10',
    text: 'text-notice-destructive-fg',
    mutedText: 'text-notice-destructive-fg',
    indicator: 'bg-accent2',
  },
  {
    variant: 'info',
    background: 'bg-notice-info/20',
    mutedBackground: 'bg-notice-info/10',
    text: 'text-notice-info-fg',
    mutedText: 'text-notice-info-fg',
    indicator: 'bg-accent5',
  },
  {
    variant: 'warning',
    background: 'bg-notice-warning/20',
    mutedBackground: 'bg-notice-warning/10',
    text: 'text-notice-warning-fg',
    mutedText: 'text-notice-warning-fg',
    indicator: 'bg-accent6',
  },
  {
    variant: 'accent',
    background: 'bg-badge-purple/20',
    mutedBackground: 'bg-badge-purple/10',
    text: 'text-badge-purple',
    mutedText: 'text-badge-purple',
    indicator: 'bg-badge-purple',
  },
  {
    variant: 'orange',
    background: 'bg-badge-orange/20',
    mutedBackground: 'bg-badge-orange/10',
    text: 'text-badge-orange',
    mutedText: 'text-badge-orange',
    indicator: 'bg-badge-orange',
  },
  {
    variant: 'cyan',
    background: 'bg-badge-cyan/20',
    mutedBackground: 'bg-badge-cyan/10',
    text: 'text-badge-cyan',
    mutedText: 'text-badge-cyan',
    indicator: 'bg-badge-cyan',
  },
  {
    variant: 'pink',
    background: 'bg-badge-pink/20',
    mutedBackground: 'bg-badge-pink/10',
    text: 'text-badge-pink',
    mutedText: 'text-badge-pink',
    indicator: 'bg-badge-pink',
  },
] as const satisfies ReadonlyArray<{
  variant: BadgeVariant;
  background: string;
  mutedBackground: string;
  text: string;
  mutedText: string;
  indicator: string;
}>;

const sizeCases = [
  {
    size: 'xs',
    height: 'h-[18px]',
    text: 'text-ui-xs',
    withoutLeadingVisual: 'px-1.5',
    withLeadingVisual: 'pl-1',
    indicator: 'size-1',
  },
  {
    size: 'sm',
    height: 'h-5',
    text: 'text-ui-xs',
    withoutLeadingVisual: 'px-1.5',
    withLeadingVisual: 'px-1.5',
    indicator: 'size-1',
  },
  {
    size: 'md',
    height: 'h-[22px]',
    text: 'text-ui-sm',
    withoutLeadingVisual: 'px-2',
    withLeadingVisual: 'pl-1.5',
    indicator: 'size-1.5',
  },
] as const satisfies ReadonlyArray<{
  size: BadgeSize;
  height: string;
  text: string;
  withoutLeadingVisual: string;
  withLeadingVisual: string;
  indicator: string;
}>;

afterEach(() => {
  cleanup();
});

describe('Badge', () => {
  it('renders as inline phrasing content and forwards HTML attributes', () => {
    render(<Badge title="Publication status">Published</Badge>);

    const badge = screen.getByText('Published');
    expect(badge.tagName).toBe('SPAN');
    expect(badge.getAttribute('title')).toBe('Publication status');
    expect(badge.querySelector('span')).toBeNull();
    expect(Array.from(badge.classList)).toEqual(
      expect.arrayContaining(['inline-flex', 'items-center', 'rounded-full', 'font-medium']),
    );
  });

  it('keeps status indicators decorative', () => {
    const { container } = render(<Badge indicator="pulse">Running</Badge>);

    const badge = screen.getByText('Running');
    expect(badge.hasAttribute('indicator')).toBe(false);
    const indicator = container.querySelector('[aria-hidden="true"]');
    expect(indicator).not.toBeNull();
    expect(indicator?.classList.contains('shrink-0')).toBe(true);
    expect(indicator?.classList.contains('rounded-full')).toBe(true);
  });

  it('only animates pulse indicators and keeps their semantic color', () => {
    const { container, rerender } = render(
      <Badge variant="info" indicator="pulse">
        Live
      </Badge>,
    );

    const pulse = container.querySelector('[aria-hidden="true"]');
    expect(pulse?.classList.contains('bg-accent5')).toBe(true);
    expect(pulse?.classList.contains('motion-safe:animate-pulse')).toBe(true);

    rerender(
      <Badge variant="info" indicator="dot">
        Connected
      </Badge>,
    );

    expect(container.querySelector('[aria-hidden="true"]')?.classList.contains('motion-safe:animate-pulse')).toBe(
      false,
    );
  });

  it.each(toneCases)('renders the $variant tone with both emphasis levels', tone => {
    render(
      <>
        <Badge variant={tone.variant}>{tone.variant} default</Badge>
        <Badge variant={tone.variant} emphasis="muted">
          {tone.variant} muted
        </Badge>
        <Badge variant={tone.variant} indicator="dot">
          {tone.variant} indicator
        </Badge>
      </>,
    );

    const defaultBadge = screen.getByText(`${tone.variant} default`);
    const mutedBadge = screen.getByText(`${tone.variant} muted`);
    const indicatorBadge = screen.getByText(`${tone.variant} indicator`);

    expect(defaultBadge.classList.contains(tone.background)).toBe(true);
    expect(defaultBadge.classList.contains(tone.text)).toBe(true);
    expect(defaultBadge.classList.contains('border')).toBe(false);
    expect(mutedBadge.classList.contains(tone.mutedBackground)).toBe(true);
    expect(mutedBadge.classList.contains(tone.mutedText)).toBe(true);
    expect(indicatorBadge.querySelector('[aria-hidden="true"]')?.classList.contains(tone.indicator)).toBe(true);
  });

  it.each(sizeCases)('renders the compact $size size with balanced leading visuals', sizeCase => {
    render(
      <>
        <Badge size={sizeCase.size}>{sizeCase.size} plain</Badge>
        <Badge size={sizeCase.size} icon={<svg data-testid={`${sizeCase.size}-icon`} />}>
          {sizeCase.size} icon
        </Badge>
        <Badge size={sizeCase.size} indicator="dot">
          {sizeCase.size} indicator
        </Badge>
      </>,
    );

    const plainBadge = screen.getByText(`${sizeCase.size} plain`);
    const iconBadge = screen.getByText(`${sizeCase.size} icon`);
    const indicatorBadge = screen.getByText(`${sizeCase.size} indicator`);
    const indicator = indicatorBadge.querySelector('[aria-hidden="true"]');

    expect(plainBadge.classList.contains(sizeCase.height)).toBe(true);
    expect(plainBadge.classList.contains(sizeCase.text)).toBe(true);
    expect(plainBadge.classList.contains(sizeCase.withoutLeadingVisual)).toBe(true);
    expect(plainBadge.querySelector('span')).toBeNull();
    expect(iconBadge.classList.contains(sizeCase.withLeadingVisual)).toBe(true);
    expect(screen.getByTestId(`${sizeCase.size}-icon`)).not.toBeNull();
    expect(indicatorBadge.classList.contains(sizeCase.withLeadingVisual)).toBe(true);
    expect(indicator?.classList.contains(sizeCase.indicator)).toBe(true);
  });
});
