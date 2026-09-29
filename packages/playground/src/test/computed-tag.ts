import { expect } from 'vitest';

/**
 * Asserts that `element` is a `ComputedTag` rendered as a categorical badge hue.
 */
export function expectComputedTag(element: HTMLElement | null, value: string) {
  expect(element, `expected a computed tag for "${value}"`).not.toBeNull();
  const tag = element as HTMLElement;
  expect(tag.getAttribute('data-testid')).toBe('computed-tag');
  expect(tag.className).toMatch(/(^|\s)bg-badge-[a-z]+-strong(\s|$)/);
}

/**
 * Asserts that a remove button inside a `ComputedTag` inherits the tag foreground color
 * (no own `text-*` color utility) instead of overriding it with a neutral color.
 */
export function expectInheritsTagForeground(button: HTMLElement) {
  expect(button.className).not.toMatch(/(^|\s)(hover:)?text-(neutral|accent)\d/);
  expect(button.className).toMatch(/(^|\s)cursor-pointer(\s|$)/);
}
