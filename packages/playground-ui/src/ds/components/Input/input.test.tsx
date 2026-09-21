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

  it('prioritizes the focus border over hover for the outline variant', () => {
    render(<Input variant="outline" placeholder="outline" />);

    expectOnlyGuardedHoverBorder(screen.getByPlaceholderText('outline').className);
  });
});
