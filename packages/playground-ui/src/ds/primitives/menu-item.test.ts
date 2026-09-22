import { describe, expect, it } from 'vitest';
import { menuItemClass, menuItemDestructiveClass } from './menu-item';

// A row inside a fluid menu sits on the travelling highlight: any background the
// row paints itself (hover, press, highlight) stacks a second surface on top.
function paintedBackgrounds(className: string) {
  return className.split(' ').filter(utility => /(^|:)bg-/.test(utility) && !utility.endsWith('bg-transparent'));
}

describe('menu item recipes', () => {
  it.each([
    ['default', menuItemClass],
    ['destructive', menuItemDestructiveClass],
  ])('%s rows paint no background of their own', (_, className) => {
    expect(paintedBackgrounds(className)).toEqual([]);
  });
});
