import { Container } from '@earendil-works/pi-tui';
import type { SelectItem, TUI } from '@earendil-works/pi-tui';
import { showModalOverlay } from '../overlay.js';
import { MenuList } from './menu-list.js';

/** Single-choice menu. Resolves with the chosen value, or null on cancel. */
export function promptSelect(tui: TUI, title: string, items: SelectItem[]): Promise<string | null> {
  return new Promise(resolve => {
    const container = new Container();
    const selectList = new MenuList(items, Math.min(items.length, 12));
    const close = (value: string | null) => {
      tui.hideOverlay();
      tui.requestRender();
      resolve(value);
    };
    selectList.onSelect = item => close(item.value);
    selectList.onCancel = () => close(null);

    container.addChild(selectList);
    (container as Container & { handleInput: (data: string) => void }).handleInput = data =>
      selectList.handleInput(data);

    showModalOverlay(tui, container, { title });
  });
}
