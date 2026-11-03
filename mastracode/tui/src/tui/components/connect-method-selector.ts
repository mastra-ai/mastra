import type { TUI } from '@earendil-works/pi-tui';
import { promptSelect } from './simple-select.js';

export type ConnectMethod = 'account' | 'api-key';

export async function promptConnectMethod(tui: TUI): Promise<ConnectMethod | null> {
  const method = await promptSelect(tui, 'Select authentication method', [
    { value: 'account', label: 'Sign in with an account' },
    { value: 'api-key', label: 'Sign in with an API key' },
  ]);
  return method as ConnectMethod | null;
}
