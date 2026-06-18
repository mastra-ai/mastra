import type { SlashCommandContext } from './types.js';

export function handleYoloCommand(ctx: SlashCommandContext): void {
  const current = (ctx.state.session.state.get() as any)?.yolo === true;
  void ctx.state.session.state.set({ yolo: !current } as any);
  ctx.showInfo(!current ? 'YOLO mode ON — tools auto-approved' : 'YOLO mode OFF — tools require approval');
}
