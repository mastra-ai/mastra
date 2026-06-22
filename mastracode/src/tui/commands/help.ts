import { loadSettings } from '../../onboarding/settings';
import { buildHelpText } from '../components/help-overlay';
import { describeShellPassthroughInvocation, resolveShellPassthroughInvocation } from '../shell-config';
import type { SlashCommandContext } from './types';

export function handleHelpCommand(ctx: SlashCommandContext): void {
  const shellInvocation = resolveShellPassthroughInvocation('', loadSettings().shellPassthrough);
  const text = buildHelpText({
    modes: ctx.harness.listModes().length,
    customSlashCommands: ctx.customSlashCommands,
    shellModeLabel: describeShellPassthroughInvocation(shellInvocation),
  });
  ctx.showInfo(text);
}
