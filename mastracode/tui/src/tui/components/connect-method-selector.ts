import { Box, SelectList, Spacer, Text } from '@earendil-works/pi-tui';
import type { SelectItem, TUI } from '@earendil-works/pi-tui';
import { showModalOverlay } from '../overlay.js';
import { getSelectListTheme, theme } from '../theme.js';

export type ConnectMethod = 'account' | 'api-key';

export function promptConnectMethod(tui: TUI): Promise<ConnectMethod | null> {
  return new Promise(resolve => {
    const container = new Box(4, 2, text => theme.bg('overlayBg', text));
    container.addChild(new Text(theme.bold(theme.fg('accent', 'Select authentication method:')), 0, 0));
    container.addChild(new Spacer(1));

    const items: SelectItem[] = [
      { value: 'account', label: '  Sign in with an account' },
      { value: 'api-key', label: '  Sign in with an API key' },
    ];
    const selectList = new SelectList(items, items.length, getSelectListTheme());

    const close = () => {
      tui.hideOverlay();
      tui.requestRender();
    };

    selectList.onSelect = item => {
      close();
      resolve(item.value as ConnectMethod);
    };
    selectList.onCancel = () => {
      close();
      resolve(null);
    };

    container.addChild(selectList);
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter select · Esc/Ctrl+C cancel'), 0, 0));
    (container as Box & { handleInput: (data: string) => void }).handleInput = data => selectList.handleInput(data);

    showModalOverlay(tui, container, { widthPercent: 0.8, maxHeight: '60%' });
  });
}
