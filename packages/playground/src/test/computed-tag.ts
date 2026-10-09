import { expect } from 'vitest';

export function expectComputedTag(element: HTMLElement | null, value: string) {
  expect(element, `expected a computed tag for "${value}"`).not.toBeNull();
  const tag = element as HTMLElement;
  expect(tag.getAttribute('data-testid')).toBe('computed-tag');
  expect(tag.className).toMatch(/(^|\s)bg-badge-[a-z]+-strong(\s|$)/);
}

export function expectInheritsTagForeground(button: HTMLElement) {
  expect(button.className).not.toMatch(/(^|\s)([a-z-]+:)*text-/);
  expect(button.className).toMatch(/(^|\s)cursor-pointer(\s|$)/);
}
