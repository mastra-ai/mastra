// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TooltipProvider } from '../Tooltip';
import { Button, buttonVariants } from './Button';
import type { ButtonVariant } from './Button';

afterEach(() => {
  cleanup();
});

describe('Button', () => {
  it('uses semantic neutral roles with distinct interaction states', () => {
    const baseClasses = buttonVariants().split(' ');
    expect(baseClasses).toEqual(
      expect.arrayContaining(['transition-[background-color,border-color,color]', 'motion-reduce:transition-none']),
    );
    expect(baseClasses).not.toContain('transition-all');

    const variants: ButtonVariant[] = ['default', 'primary', 'destructive', 'destructive-ghost', 'ghost', 'outline'];
    const expectedClasses = {
      default: [
        'new-theme',
        'border-border',
        'bg-foreground/10',
        'text-foreground',
        'not-disabled:hover:bg-foreground/14',
        'not-disabled:active:bg-foreground/18',
      ],
      primary: [
        'bg-foreground',
        'text-background',
        'not-disabled:hover:bg-foreground/75',
        'not-disabled:active:bg-foreground/60',
      ],
      destructive: ['not-disabled:hover:bg-accent2/80', 'not-disabled:active:bg-accent2/70'],
      'destructive-ghost': ['not-disabled:hover:bg-accent2/20', 'not-disabled:active:bg-accent2/30'],
      ghost: ['text-foreground/90', 'not-disabled:hover:bg-foreground/4', 'not-disabled:active:bg-foreground/10'],
      outline: [
        'border-foreground/30',
        'bg-transparent',
        'text-foreground',
        'not-disabled:hover:border-foreground/45',
        'not-disabled:hover:bg-foreground/4',
        'not-disabled:active:bg-foreground/10',
      ],
    } satisfies Record<ButtonVariant, string[]>;

    for (const variant of variants) {
      const classes = buttonVariants({ variant }).split(' ');
      expect(classes).toEqual(expect.arrayContaining(expectedClasses[variant]));
    }
  });

  it('defaults native buttons to type button', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('button');
  });

  it('preserves an explicit submit type', () => {
    render(<Button type="submit">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('submit');
  });

  it('composes with links through render', () => {
    render(<Button render={<a href="/docs" />}>Read docs</Button>);
    const link = screen.getByRole('link', { name: 'Read docs' });
    expect(link.getAttribute('href')).toBe('/docs');
    expect(link.className).toContain('new-theme');
  });

  describe('icon prop', () => {
    it('renders the icon inside an <Icon> slot before the label', () => {
      render(
        <Button icon={<svg data-testid="icon" />} size="sm">
          Add item
        </Button>,
      );

      const button = screen.getByRole('button', { name: 'Add item' });
      const slot = button.querySelector('[data-slot="button-icon"]');
      expect(slot).not.toBeNull();
      expect(slot?.contains(screen.getByTestId('icon'))).toBe(true);
      expect(button.firstElementChild).toBe(slot);
    });

    it('does not render a slot when no icon is provided', () => {
      render(<Button>Plain</Button>);
      expect(screen.getByRole('button').querySelector('[data-slot="button-icon"]')).toBeNull();
    });

    it('is ignored in icon-mode sizes', () => {
      render(
        <Button size="icon-md" icon={<svg data-testid="ignored" />} aria-label="Close">
          <svg data-testid="child" />
        </Button>,
      );
      const button = screen.getByRole('button', { name: 'Close' });
      expect(button.querySelector('[data-slot="button-icon"]')).toBeNull();
      expect(screen.queryByTestId('ignored')).toBeNull();
      expect(screen.getByTestId('child')).toBeTruthy();
    });

    it('does not derive aria-label from tooltip when a label is present', () => {
      render(
        <TooltipProvider>
          <Button icon={<svg />} tooltip="Add a new item">
            Add
          </Button>
        </TooltipProvider>,
      );
      expect(screen.getByRole('button', { name: 'Add' }).getAttribute('aria-label')).toBeNull();
    });
  });
});
