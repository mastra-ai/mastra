// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Badge } from './Badge';
import type { BadgeSize, BadgeVariant } from './Badge';

const variants = [
  'neutral',
  'green',
  'red',
  'blue',
  'yellow',
  'purple',
  'orange',
  'cyan',
  'pink',
] as const satisfies ReadonlyArray<BadgeVariant>;

const sizes = ['xs', 'sm', 'md'] as const satisfies ReadonlyArray<BadgeSize>;

const indicatorOf = (badge: HTMLElement) => badge.querySelector('[aria-hidden="true"]')?.className ?? '';

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
      expect(pulse?.classList.contains('bg-badge-blue')).toBe(true);
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
    it.each(variants)('gives %s a muted step of its own', variant => {
      render(
        <>
          <Badge variant={variant}>default</Badge>
          <Badge variant={variant} emphasis="muted">
            muted
          </Badge>
        </>,
      );

      expect(screen.getByText('muted').className).not.toBe(screen.getByText('default').className);
    });

    it('never reuses a tone between two variants', () => {
      render(
        <>
          {variants.map(variant => (
            <Badge key={variant} variant={variant} indicator="dot">
              {variant}
            </Badge>
          ))}
        </>,
      );

      const badges = variants.map(variant => screen.getByText(variant));
      expect(new Set(badges.map(badge => badge.className)).size).toBe(variants.length);
      expect(new Set(badges.map(indicatorOf)).size).toBe(variants.length);
    });
  });

  describe('when a compact size is selected', () => {
    it('gives each size its own scale', () => {
      render(
        <>
          {sizes.map(size => (
            <Badge key={size} size={size} indicator="dot">
              {size}
            </Badge>
          ))}
        </>,
      );

      const badges = sizes.map(size => screen.getByText(size));
      expect(new Set(badges.map(badge => badge.className)).size).toBe(sizes.length);
    });

    it.each(sizes)('pads %s the same for an icon and an indicator', size => {
      render(
        <>
          <Badge size={size} icon={<svg data-testid="icon" />}>
            icon
          </Badge>
          <Badge size={size} indicator="dot">
            indicator
          </Badge>
        </>,
      );

      expect(screen.getByTestId('icon')).not.toBeNull();
      expect(screen.getByText('icon').className).toBe(screen.getByText('indicator').className);
    });

    it('rebalances padding once a leading visual takes the lead', () => {
      render(
        <>
          <Badge>plain</Badge>
          <Badge indicator="dot">indicator</Badge>
        </>,
      );

      expect(screen.getByText('indicator').className).not.toBe(screen.getByText('plain').className);
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
