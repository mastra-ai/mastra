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
    render(<Badge>Published</Badge>);

    const badge = screen.getByText('Published');
    expectClasses(badge, ['inline-flex', 'w-fit', 'max-w-full', 'h-badge-default', 'text-ui-sm', 'gap-1', 'px-2.5']);
  });

  it('supports the sm size', () => {
    render(<Badge size="sm">Draft</Badge>);

    const badge = screen.getByText('Draft');
    expectClasses(badge, ['h-form-xs', 'text-ui-xs', 'gap-1', 'px-2']);
  });

  it('supports the xs size', () => {
    render(<Badge size="xs">New</Badge>);

    const badge = screen.getByText('New');
    expectClasses(badge, ['h-5', 'text-ui-xs', 'gap-0.5', 'px-1.5']);
  });

  it('uses size-specific padding when an icon is present', () => {
    const { rerender } = render(<Badge icon={<svg />}>Medium</Badge>);

    expectClasses(screen.getByText('Medium'), ['pl-2', 'pr-2.5']);

    rerender(
      <Badge size="sm" icon={<svg />}>
        Small
      </Badge>,
    );
    expectClasses(screen.getByText('Small'), ['pl-1.5', 'pr-2']);

    rerender(
      <Badge size="xs" icon={<svg />}>
        Extra small
      </Badge>,
    );
    expectClasses(screen.getByText('Extra small'), ['pl-1', 'pr-1.5']);
  });
});
