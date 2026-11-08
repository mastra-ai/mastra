import { Text, visibleWidth } from '@earendil-works/pi-tui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PickerList } from '../picker-list.js';

const textRender = Text.prototype.render;
const strip = (lines: string[]) => lines.map(line => line.replace(/\x1b\[[0-9;]*m/g, '').trimEnd());
const items = (count: number) => Array.from({ length: count }, (_, i) => `item-${i}`);

function list(options: { maxVisible?: number; emptyText?: () => string } = {}) {
  return new PickerList<string>({
    ...options,
    renderItem: (item, selected) => [`${selected ? '> ' : '  '}${item}`],
  });
}

describe('PickerList', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('centres the window on the selection and clamps it at both ends', () => {
    const picker = list({ maxVisible: 3 });

    picker.setItems(items(10), 5);
    expect(strip(picker.render(40))).toEqual(['  item-4', '> item-5', '  item-6', '(6/10)']);

    picker.setItems(items(10), 0);
    expect(strip(picker.render(40))).toEqual(['> item-0', '  item-1', '  item-2', '(1/10)']);

    picker.setItems(items(10), 9);
    expect(strip(picker.render(40))).toEqual(['  item-7', '  item-8', '> item-9', '(10/10)']);
  });

  it('shows every item and no scroll indicator when the list fits or has no limit', () => {
    const fits = list({ maxVisible: 3 });
    fits.setItems(items(3), 1);
    expect(strip(fits.render(40))).toEqual(['  item-0', '> item-1', '  item-2']);

    const unlimited = list();
    unlimited.setItems(items(20), 19);
    expect(strip(unlimited.render(40))).toHaveLength(20);
  });

  it('renders the empty text only when there are no items and one is given', () => {
    const withText = list({ emptyText: () => 'Nothing here' });
    withText.setItems([], 0);
    expect(strip(withText.render(40))).toEqual(['Nothing here']);

    const withoutText = list();
    withoutText.setItems([], 0);
    expect(withoutText.render(40)).toEqual([]);
  });

  it('windows by item, keeping every line of a multi-line item and wrapping long lines', () => {
    const picker = new PickerList<string>({
      maxVisible: 2,
      renderItem: (item, selected) => [`${selected ? '> ' : '  '}${item}`, `    detail for ${item}`],
    });
    picker.setItems(items(5), 2);
    expect(strip(picker.render(40))).toEqual([
      '  item-1',
      '    detail for item-1',
      '> item-2',
      '    detail for item-2',
      '(3/5)',
    ]);

    const narrow = picker.render(12);
    expect(narrow.length).toBeGreaterThan(5);
    expect(narrow.every(line => visibleWidth(line) <= 12)).toBe(true);
  });

  it('keeps each row wrapped between frames until the list is invalidated', () => {
    const picker = list({ maxVisible: 3 });
    picker.setItems(items(10), 5);

    const results: string[][] = [];
    vi.spyOn(Text.prototype, 'render').mockImplementation(function (this: Text, width: number) {
      const lines = textRender.call(this, width);
      results.push(lines);
      return lines;
    });

    picker.render(40);
    const first = results.splice(0);
    picker.render(40);
    const second = results.splice(0);
    expect(second).toHaveLength(first.length);
    second.forEach((lines, i) => expect(lines).toBe(first[i]));

    picker.invalidate();
    picker.render(40);
    results.forEach((lines, i) => expect(lines).not.toBe(first[i]));
  });

  it('pads each row by paddingX and paddingY', () => {
    const picker = new PickerList<string>({ paddingX: 1, paddingY: 1, renderItem: item => [item] });
    picker.setItems(['a', 'b'], 0);
    expect(picker.render(5)).toEqual(['     ', ' a   ', '     ', '     ', ' b   ', '     ']);
  });
});
