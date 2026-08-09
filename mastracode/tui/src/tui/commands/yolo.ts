import type { SlashCommandContext } from './types.js';

export async function handleYoloCommand(ctx: SlashCommandContext): Promise<void> {
  const current = (ctx.state.session.state.get() as any)?.yolo === true;
  try {
    await ctx.state.session.state.set({ yolo: !current } as any);
    ctx.showInfo(!current ? 'YOLO mode ON — tools auto-approved' : 'YOLO mode OFF — tools require approval');
  } catch (error) {
    const action = current ? 'disable' : 'enable';
    ctx.showError(`Failed to ${action} YOLO mode: ${error instanceof Error ? error.message : String(error)}`);
  }
}
