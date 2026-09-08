import { stringToColor } from '@mastra/playground-ui/utils/colors';
import { expect } from 'vitest';

/**
 * Asserts that `element` is a `ComputedTag` whose colors are derived from `value`.
 * jsdom normalizes inline colors to rgb(...), so the expected hsl() is fed through a probe element.
 */
export function expectComputedTag(element: HTMLElement | null, value: string) {
  expect(element, `expected a computed tag for "${value}"`).not.toBeNull();
  const tag = element as HTMLElement;
  expect(tag.getAttribute('data-testid')).toBe('computed-tag');

  const probe = document.createElement('div');
  probe.style.backgroundColor = stringToColor(value);
  probe.style.color = stringToColor(value, 25);

  expect(tag.style.backgroundColor).toBe(probe.style.backgroundColor);
  expect(tag.style.color).toBe(probe.style.color);
}

/**
 * Asserts that a remove button inside a `ComputedTag` inherits the tag foreground color
 * (no own `text-*` color utility) instead of overriding it with a neutral color.
 */
export function expectInheritsTagForeground(button: HTMLElement) {
  expect(button.className).not.toMatch(/(^|\s)(hover:)?text-(neutral|accent)\d/);
  expect(button.className).toMatch(/(^|\s)cursor-pointer(\s|$)/);
}
