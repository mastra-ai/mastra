import { promptConnectMethod } from '../components/connect-method-selector.js';
import { handleApiKeysCommand } from './api-keys.js';
import { handleLoginCommand } from './login.js';
import type { SlashCommandContext } from './types.js';

export async function handleConnectCommand(ctx: SlashCommandContext): Promise<void> {
  const method = await promptConnectMethod(ctx.state.ui);
  if (method === 'account') {
    await handleLoginCommand(ctx, 'login');
  } else if (method === 'api-key') {
    await handleApiKeysCommand(ctx);
  }
}
