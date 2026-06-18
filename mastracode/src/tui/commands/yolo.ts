import type { SlashCommandContext } from './types.js';

export function handleYoloCommand(ctx: SlashCommandContext): void {
  const current = (ctx.harness.session.state.get() as any).yolo === true;
  ctx.harness.session.state.set({ yolo: !current } as any);
  ctx.showInfo(!current ? 'YOLO mode ON — tools auto-approved' : 'YOLO mode OFF — tools require approval');
}
