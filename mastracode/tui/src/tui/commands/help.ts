import { loadSettings } from '@internal/mastracode/onboarding/settings';
import { buildHelpText } from '../components/help-overlay.js';
import { describeShellPassthroughInvocation, resolveShellPassthroughInvocation } from '../shell-config.js';
import type { SlashCommandContext } from './types.js';

export function handleHelpCommand(ctx: SlashCommandContext): void {
  const shellInvocation = resolveShellPassthroughInvocation('', loadSettings().shellPassthrough);
  const text = buildHelpText({
    modes: ctx.controller.listModes().length,
    customSlashCommands: ctx.customSlashCommands,
    shellModeLabel: describeShellPassthroughInvocation(shellInvocation),
  });
  ctx.showInfo(text);
}
