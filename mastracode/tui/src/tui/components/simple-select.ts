import { Box, SelectList, Spacer, Text } from '@earendil-works/pi-tui';
import type { SelectItem, TUI } from '@earendil-works/pi-tui';
import { showModalOverlay } from '../overlay.js';
import { getSelectListTheme, theme } from '../theme.js';

/** Modal single-choice picker. Resolves with the chosen value, or null on cancel. */
export function promptSelect(tui: TUI, title: string, items: SelectItem[]): Promise<string | null> {
  return new Promise(resolve => {
    const container = new Box(4, 2, text => theme.bg('overlayBg', text));
    container.addChild(new Text(theme.bold(theme.fg('accent', title)), 0, 0));
    container.addChild(new Spacer(1));

    const selectList = new SelectList(items, Math.min(items.length, 12), getSelectListTheme());
    const close = (value: string | null) => {
      tui.hideOverlay();
      tui.requestRender();
      resolve(value);
    };
    selectList.onSelect = item => close(item.value);
    selectList.onCancel = () => close(null);

    container.addChild(selectList);
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter select · Esc cancel'), 0, 0));
    (container as Box & { handleInput: (data: string) => void }).handleInput = data => selectList.handleInput(data);

    showModalOverlay(tui, container, { widthPercent: 0.8, maxHeight: '60%' });
  });
}
