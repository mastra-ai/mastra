import type { IToolExecutionComponent } from '../components/tool-execution-interface.js';
import type { SlashCommandContext } from './types.js';

function applyCurrentModeColorToRenderedTools(ctx: SlashCommandContext): void {
  const color = ctx.state.session.mode.resolve().metadata?.color;
  const modeColor = typeof color === 'string' ? color : undefined;
  for (const tool of ctx.state.allToolComponents as IToolExecutionComponent[]) {
    tool.setCompactToolModeColor?.(modeColor);
  }
  ctx.state.ui.requestRender();
}

export async function handleModeCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const modes = ctx.controller.listModes();
  if (modes.length <= 1) {
    ctx.showInfo('Only one mode available');
    return;
  }
  if (args[0]) {
    try {
      await ctx.state.session.mode.switch({ modeId: args[0] });
      applyCurrentModeColorToRenderedTools(ctx);
    } catch (err) {
      ctx.showError(`Failed to switch mode: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    const currentMode = ctx.state.session.mode.resolve();
    const modeList = modes
      .map(m => `  ${m.id === currentMode?.id ? '* ' : '  '}${m.name}${m.description ? ` - ${m.description}` : ''}`)
      .join('\n');
    ctx.showInfo(`Modes:\n${modeList}`);
  }
}
