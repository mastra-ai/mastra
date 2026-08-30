// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Badge } from './Badge';
import type { BadgeSize, BadgeVariant } from './Badge';

const toneCases = [
  {
    variant: 'neutral',
    background: 'bg-neutral6/5',
    mutedBackground: 'bg-neutral6/5',
    text: 'text-badge-neutral-fg',
    mutedText: 'text-badge-neutral-fg',
    indicator: 'bg-neutral3',
  },
  {
    variant: 'green',
    background: 'bg-badge-green/20',
    mutedBackground: 'bg-badge-green/10',
    text: 'text-badge-green-fg',
    mutedText: 'text-badge-green-fg',
    indicator: 'bg-badge-green',
  },
  {
    variant: 'red',
    background: 'bg-notice-destructive/20',
    mutedBackground: 'bg-notice-destructive/10',
    text: 'text-notice-destructive-fg',
    mutedText: 'text-notice-destructive-fg',
    indicator: 'bg-accent2',
  },
  {
    variant: 'blue',
    background: 'bg-notice-info/20',
    mutedBackground: 'bg-notice-info/10',
    text: 'text-notice-info-fg',
    mutedText: 'text-notice-info-fg',
    indicator: 'bg-accent5',
  },
  {
    variant: 'yellow',
    background: 'bg-notice-warning/20',
    mutedBackground: 'bg-notice-warning/10',
    text: 'text-notice-warning-fg',
    mutedText: 'text-notice-warning-fg',
    indicator: 'bg-accent6',
  },
  {
    variant: 'purple',
    background: 'bg-badge-purple/20',
    mutedBackground: 'bg-badge-purple/10',
    text: 'text-badge-purple-fg',
    mutedText: 'text-badge-purple-fg',
    indicator: 'bg-badge-purple',
  },
  {
    variant: 'orange',
    background: 'bg-badge-orange/20',
    mutedBackground: 'bg-badge-orange/10',
    text: 'text-badge-orange-fg',
    mutedText: 'text-badge-orange-fg',
    indicator: 'bg-badge-orange',
  },
  {
    variant: 'cyan',
    background: 'bg-badge-cyan/20',
    mutedBackground: 'bg-badge-cyan/10',
    text: 'text-badge-cyan-fg',
    mutedText: 'text-badge-cyan-fg',
    indicator: 'bg-badge-cyan',
  },
  {
    variant: 'pink',
    background: 'bg-badge-pink/20',
    mutedBackground: 'bg-badge-pink/10',
    text: 'text-badge-pink-fg',
    mutedText: 'text-badge-pink-fg',
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
  describe('when rendered inside text', () => {
    it('uses phrasing content and forwards span attributes', () => {
      render(
        <p>
          Status: <Badge title="Publication status">Published</Badge>
        </p>,
      );

      const badge = screen.getByText('Published');
      expect(badge.tagName).toBe('SPAN');
      expect(badge.getAttribute('title')).toBe('Publication status');
      expect(badge.parentElement?.textContent).toBe('Status: Published');
      expect(badge.classList.contains('bg-neutral6/5')).toBe(true);
      expect(badge.classList.contains('text-badge-neutral-fg')).toBe(true);
      expect(Array.from(badge.classList)).toEqual(
        expect.arrayContaining([
          'rounded-[7px]',
          'inset-ring-1',
          'inset-ring-current/5',
          'inset-shadow-xs',
          'inset-shadow-white/5',
          'dark:inset-shadow-[0_3px_10px_-2px_white]',
          'dark:inset-shadow-white/7',
          'dark:bg-linear-to-b',
          'dark:from-white/3',
          'dark:to-white/0',
        ]),
      );
    });
  });

  describe('when rendered with a status indicator', () => {
    it('keeps the indicator decorative and off the public DOM attributes', () => {
      render(<Badge indicator="dot">Connected</Badge>);

      const badge = screen.getByText('Connected');
      const indicator = badge.querySelector('[aria-hidden="true"]');

      expect(badge.hasAttribute('indicator')).toBe(false);
      expect(indicator).not.toBeNull();
      expect(indicator?.textContent).toBe('');
    });

    it('only animates pulse indicators and keeps their selected color', () => {
      const { container, rerender } = render(
        <Badge variant="blue" indicator="pulse">
          Live
        </Badge>,
      );

      const pulse = container.querySelector('[aria-hidden="true"]');
      expect(pulse?.classList.contains('bg-accent5')).toBe(true);
      expect(pulse?.classList.contains('motion-safe:animate-pulse')).toBe(true);

      rerender(
        <Badge variant="blue" indicator="dot">
          Connected
        </Badge>,
      );

      expect(container.querySelector('[aria-hidden="true"]')?.classList.contains('motion-safe:animate-pulse')).toBe(
        false,
      );
    });
  });

  describe('when a tone is selected', () => {
    it.each(toneCases)('renders the $variant palette across emphasis and indicator treatments', tone => {
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
  });

  describe('when a compact size is selected', () => {
    it.each(sizeCases)('renders the $size scale with balanced leading visuals', sizeCase => {
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

  describe('when rendered with an icon', () => {
    it('renders the icon while preserving the badge label', () => {
      render(<Badge icon={<svg data-testid="badge-icon" />}>Template</Badge>);

      expect(screen.getByText('Template')).not.toBeNull();
      expect(screen.getByTestId('badge-icon')).not.toBeNull();
    });

    it('does not reserve an icon wrapper for an empty icon', () => {
      render(<Badge icon={null}>Template</Badge>);

      expect(screen.getByText('Template').querySelector('span')).toBeNull();
    });
  });
});
