// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '../Tooltip';
import { Button, buttonVariants } from './Button';
import type { ButtonVariant } from './Button';

afterEach(() => {
  cleanup();
});

describe('Button', () => {
  it('uses semantic roles with distinct interaction states', () => {
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
      destructive: ['bg-destructive', 'not-disabled:hover:bg-destructive/80', 'not-disabled:active:bg-destructive/70'],
      'destructive-ghost': [
        'text-destructive',
        'not-disabled:hover:bg-destructive/20',
        'not-disabled:active:bg-destructive/30',
      ],
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

  // Base UI renders `type="button"` when the prop is absent. Keeping the attribute off
  // preserves the native `submit` default, so a form button that never set a type keeps
  // submitting instead of silently going inert.
  it('leaves type off so a form button keeps the native submit default', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('type')).toBe(false);
  });

  it('preserves an explicit submit type', () => {
    render(<Button type="submit">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('submit');
  });

  // The removed `as` API still has to navigate. Without the shim a Button given
  // `as={Link}` renders a plain <button>, which looks fine and silently stops linking.
  it('still renders a link for a call site on the removed as API', () => {
    render(
      <Button as="a" href="/agents" target="_blank">
        Agents
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'Agents' });
    expect(link.getAttribute('href')).toBe('/agents');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.className).toContain('new-theme');
  });

  it('prefers render over the deprecated as API', () => {
    render(
      <Button as="a" href="/old" render={<a href="/new" />}>
        Agents
      </Button>,
    );

    expect(screen.getByRole('link', { name: 'Agents' }).getAttribute('href')).toBe('/new');
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

  // Stand-in for react-router's Link: navigates from `to`, not `href`.
  const RouterLink = React.forwardRef<HTMLAnchorElement, { to?: string; children?: React.ReactNode }>(
    ({ to, children, ...rest }, ref) => (
      <a ref={ref} href={to} data-router-link {...rest}>
        {children}
      </a>
    ),
  );

  describe('deprecated as API', () => {
    it('passes `to` through to a router link', () => {
      render(
        <Button as={RouterLink} to="/agents">
          Agents
        </Button>,
      );
      const link = screen.getByRole('link', { name: 'Agents' });
      expect(link.getAttribute('href')).toBe('/agents');
      expect(link.hasAttribute('data-router-link')).toBe(true);
    });

    it('does not leak a `to` attribute onto a plain anchor', () => {
      const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(
        <Button as="a" href="/agents">
          Agents
        </Button>,
      );
      const link = screen.getByRole('link', { name: 'Agents' });
      expect(link.hasAttribute('to')).toBe(false);
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('keeps onClick working through the shim', () => {
      const onClick = vi.fn();
      render(
        <Button as="a" href="/agents" onClick={onClick}>
          Agents
        </Button>,
      );
      screen.getByRole('link', { name: 'Agents' }).click();
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
  describe('form submission', () => {
    it('submits its form when no type is set, as a native button does', () => {
      const onSubmit = vi.fn(e => e.preventDefault());
      render(
        <form onSubmit={onSubmit}>
          <Button>Save</Button>
        </form>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('does not submit when the caller opts out with type="button"', () => {
      const onSubmit = vi.fn(e => e.preventDefault());
      render(
        <form onSubmit={onSubmit}>
          <Button type="button">Cancel</Button>
        </form>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
  describe('link renders', () => {
    it('renders an anchor without a Base UI button warning', () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(<Button render={<a href="/docs" />}>Docs</Button>);
      const link = screen.getByRole('link', { name: 'Docs' });
      expect(link.getAttribute('href')).toBe('/docs');
      expect(link.getAttribute('role')).toBeNull();
      const messages = [...err.mock.calls, ...warn.mock.calls].map(c => String(c[0])).join(' ');
      expect(messages).not.toContain('nativeButton');
      err.mockRestore();
      warn.mockRestore();
    });

    it('keeps the class from the rendered element alongside the recipe', () => {
      render(
        <Button render={<a href="/docs" className="custom-link" />} className="from-caller">
          Docs
        </Button>,
      );
      const cls = screen.getByRole('link', { name: 'Docs' }).className;
      expect(cls).toContain('custom-link');
      expect(cls).toContain('from-caller');
      expect(cls).toContain('new-theme');
    });

    it('detects a router link by its `to` prop', () => {
      render(<Button render={<RouterLink to="/agents" />}>Agents</Button>);
      expect(screen.getByRole('link', { name: 'Agents' }).getAttribute('href')).toBe('/agents');
    });

    it('still routes a real button through Base UI', () => {
      render(<Button render={<button type="submit" />}>Save</Button>);
      expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('submit');
    });
  });

  describe('deprecated prefetch', () => {
    it('forwards prefetch to the legacy element', () => {
      const seen: Record<string, unknown> = {};
      const Probe = React.forwardRef<HTMLAnchorElement, Record<string, unknown>>((props, ref) => {
        Object.assign(seen, props);
        return <a ref={ref} href={String(props.href ?? '')} {...{}} />;
      });
      render(
        <Button as={Probe} href="/x" prefetch={false}>
          x
        </Button>,
      );
      expect(seen.prefetch).toBe(false);
    });
  });
});
