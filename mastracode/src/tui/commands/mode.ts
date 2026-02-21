import type { SlashCommandContext } from './types.js';

export async function handleModeCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const modes = ctx.harness.listModes();
  if (modes.length <= 1) {
    ctx.showInfo('Only one mode available');
    return;
  }
  if (args[0]) {
    await ctx.harness.switchMode({ modeId: args[0] });
  } else {
    const currentMode = ctx.harness.getCurrentMode();
    const modeList = modes
      .map(m => `  ${m.id === currentMode?.id ? '* ' : '  '}${m.id}${m.name ? ` - ${m.name}` : ''}`)
      .join('\n');
    ctx.showInfo(`Modes:\n${modeList}`);
  }
}
