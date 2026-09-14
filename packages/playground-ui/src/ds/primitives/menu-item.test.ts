import { describe, expect, it } from 'vitest';
import { menuItemClass, menuItemDestructiveClass, menuPopupClass } from './menu-item';

describe('menuItemClass', () => {
  it('inherits the Button ghost/md size rhythm', () => {
    expect(menuItemClass).toContain('h-form-md');
    expect(menuItemClass).toContain('text-ui-smd');
    expect(menuItemClass).toContain('px-[.9em]');
    expect(menuItemClass).toContain('gap-[.75em]');
    expect(menuItemClass).toContain('hover:bg-neutral6/5');
  });

  it('overrides the pill radius with rounded-lg', () => {
    expect(menuItemClass).toContain('rounded-lg');
    expect(menuItemClass).not.toContain('rounded-full');
  });

  it('maps Base UI highlight/disabled states', () => {
    expect(menuItemClass).toContain('data-highlighted:bg-neutral6/5');
    expect(menuItemClass).toContain('data-highlighted:text-neutral6');
    expect(menuItemClass).toContain('data-disabled:opacity-50');
    expect(menuItemClass).toContain('focus-visible:border-transparent');
    expect(menuItemClass).not.toContain('focus-visible:border-neutral5/50');
  });

  it('exposes a destructive variant', () => {
    expect(menuItemDestructiveClass).toContain('text-accent2');
    expect(menuItemDestructiveClass).toContain('data-highlighted:bg-accent2/10');
    expect(menuItemDestructiveClass).toContain('rounded-lg');
  });
});

describe('menuPopupClass', () => {
  it('uses the shared surface and dropdown max-height token', () => {
    expect(menuPopupClass).toContain('bg-surface3');
    expect(menuPopupClass).toContain('z-50');
    expect(menuPopupClass).toContain('var(--max-height-dropdown-max-height)');
  });
});
