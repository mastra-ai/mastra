import { HelpOverlayComponent } from '../components/help-overlay.js';
import type { SlashCommandContext } from './types.js';

export function handleHelpCommand(ctx: SlashCommandContext): void {
  const help = new HelpOverlayComponent({
    modes: ctx.harness.listModes().length,
    customSlashCommands: ctx.customSlashCommands,
    onClose: () => ctx.state.ui.hideOverlay(),
  });

  ctx.state.ui.showOverlay(help, { width: '60%', maxHeight: '80%', anchor: 'center' });
  help.focused = true;
}
