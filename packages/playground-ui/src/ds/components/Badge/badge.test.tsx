// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Badge } from './Badge';

afterEach(() => {
  cleanup();
});

const expectClasses = (element: HTMLElement, classes: string[]) => {
  classes.forEach(className => expect(element.classList.contains(className)).toBe(true));
};

describe('Badge', () => {
  it('uses the md size by default and keeps intrinsic width', () => {
    render(<Badge data-testid="badge">Published</Badge>);

    const badge = screen.getByTestId('badge');
    expectClasses(badge, ['inline-flex', 'w-fit', 'max-w-full', 'h-badge-default', 'text-ui-sm', 'gap-1', 'px-2.5']);
  });

  it('supports the sm size', () => {
    render(
      <Badge size="sm" data-testid="badge">
        Draft
      </Badge>,
    );

    const badge = screen.getByTestId('badge');
    expectClasses(badge, ['h-form-xs', 'text-ui-xs', 'gap-1', 'px-2']);
  });

  it('supports the xs size', () => {
    render(
      <Badge size="xs" data-testid="badge">
        New
      </Badge>,
    );

    const badge = screen.getByTestId('badge');
    expectClasses(badge, ['h-5', 'text-ui-xs', 'gap-0.5', 'px-1.5']);
  });

  it('uses size-specific padding when an icon is present', () => {
    const { rerender } = render(
      <Badge icon={<svg />} data-testid="badge">
        Medium
      </Badge>,
    );

    expectClasses(screen.getByTestId('badge'), ['pl-2', 'pr-2.5']);

    rerender(
      <Badge size="sm" icon={<svg />} data-testid="badge">
        Small
      </Badge>,
    );
    expectClasses(screen.getByTestId('badge'), ['pl-1.5', 'pr-2']);

    rerender(
      <Badge size="xs" icon={<svg />} data-testid="badge">
        Extra small
      </Badge>,
    );
    expectClasses(screen.getByTestId('badge'), ['pl-1', 'pr-1.5']);
  });
});
