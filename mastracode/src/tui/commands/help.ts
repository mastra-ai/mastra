import { buildHelpText } from '../components/help-overlay.js';
import type { SlashCommandContext } from './types.js';

export function handleHelpCommand(ctx: SlashCommandContext): void {
  const text = buildHelpText({
    modes: ctx.harness.listModes().length,
    customSlashCommands: ctx.customSlashCommands,
  });
  ctx.showInfo(text);
}
