// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Input } from './input';

afterEach(() => {
  cleanup();
});

const inputVariants = ['default', 'filled', 'outline'] as const;

const expectOnlyGuardedHoverBorder = (className: string) => {
  const hoverBorderTokens = className
    .split(/\s+/)
    .filter(token => token.includes('hover') && token.includes('border-border2'));

  expect(hoverBorderTokens).toEqual(['[&:hover:not(:focus-visible)]:border-border2']);
  expect(className).toContain('focus-visible:border-neutral5/50');
  expect(className).not.toContain('hover:border-border2');
};

describe('Input', () => {
  it('keeps the filled surface as the default variant', () => {
    render(<Input placeholder="Name" />);

    expect(screen.getByPlaceholderText('Name').className).toContain('bg-surface-overlay-soft');
  });

  it('supports an outline variant without an initial filled background', () => {
    render(<Input variant="outline" placeholder="Name" />);

    const input = screen.getByPlaceholderText('Name');
    expect(input.className).toContain('bg-transparent');
    expect(input.className).toContain('rounded-full');
    expect(input.className).not.toContain('bg-surface-overlay-soft');
  });

  it('brightens the border on focus so focus clears WCAG non-text contrast (no green accent)', () => {
    render(<Input placeholder="Name" />);

    const cls = screen.getByPlaceholderText('Name').className;
    expect(cls).toContain('focus-visible:border-neutral5/50');
    expect(cls).not.toContain('ring-accent1');
    expect(cls).not.toContain('focus-visible:border-accent1');
  });

  it.each(inputVariants)('prioritizes the focus border over hover for the %s variant', variant => {
    render(<Input variant={variant} placeholder={variant} />);

    expectOnlyGuardedHoverBorder(screen.getByPlaceholderText(variant).className);
  });
});
