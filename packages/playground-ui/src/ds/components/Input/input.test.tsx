// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Input } from './input';

afterEach(() => {
  cleanup();
});

// Outline is the only variant that moves its border on hover, matching Button's
// outline. The guard keeps that hover border from outranking the focus border on a
// field that is both hovered and focused.
const expectOnlyGuardedHoverBorder = (className: string) => {
  const hoverBorderTokens = className
    .split(/\s+/)
    .filter(token => token.includes('hover') && token.includes('border-border-hover'));

  expect(hoverBorderTokens).toEqual(['[&:hover:not(:focus-visible):not(:disabled)]:border-border-hover']);
  expect(className).toContain('focus-visible:border-border-focus');
  expect(className).not.toContain('hover:border-border-focus');
};

describe('Input', () => {
  it('keeps the filled surface as the default variant', () => {
    render(<Input placeholder="Name" />);

    expect(screen.getByPlaceholderText('Name').classList.contains('bg-fill')).toBe(true);
  });

  it('still renders the filled surface for a call site on the removed filled variant', () => {
    render(<Input variant="filled" placeholder="Legacy" />);

    const input = screen.getByPlaceholderText('Legacy');
    expect(input.classList.contains('bg-fill')).toBe(true);
    expect(input.className).toContain('border-border');
  });

  it.each(['default', 'outline'] as const)(
    'uses the shared foreground text color at rest for the %s variant',
    variant => {
      render(<Input variant={variant} placeholder={variant} />);

      const cls = screen.getByPlaceholderText(variant).className;
      expect(cls).toContain('text-foreground');
      expect(cls).toContain('placeholder:text-muted-foreground');
    },
  );

  it('supports an outline variant without an initial filled background', () => {
    render(<Input variant="outline" placeholder="Name" />);

    const input = screen.getByPlaceholderText('Name');
    expect(input.className).toContain('bg-transparent');
    expect(input.className).toContain('rounded-full');
    expect(input.classList.contains('bg-fill')).toBe(false);
  });

  it('brightens the border on focus so focus clears WCAG non-text contrast (no green accent)', () => {
    render(<Input placeholder="Name" />);

    const cls = screen.getByPlaceholderText('Name').className;
    expect(cls).toContain('focus-visible:border-border-focus');
    expect(cls).not.toContain('ring-accent1');
    expect(cls).not.toContain('focus-visible:border-accent1');
  });

  it('prioritizes the focus border over hover for the outline variant', () => {
    render(<Input variant="outline" placeholder="outline" />);

    expectOnlyGuardedHoverBorder(screen.getByPlaceholderText('outline').className);
  });

  it('carries the default variant hover in the fill, leaving its border alone', () => {
    render(<Input placeholder="default" />);

    const cls = screen.getByPlaceholderText('default').className;
    expect(cls.split(/\s+/)).toContain('not-disabled:hover:bg-fill-hover');
    expect(cls.split(/\s+/).filter(token => token.includes('hover') && token.includes('border-'))).toEqual([]);
  });
});
