import type { SlashCommandContext } from './types.js';

export function handleYoloCommand(ctx: SlashCommandContext): void {
  const current = (ctx.harness.getState() as any).yolo === true;
  ctx.harness.setState({ yolo: !current } as any);
  ctx.showInfo(!current ? 'YOLO mode ON — tools auto-approved' : 'YOLO mode OFF — tools require approval');
  ctx.updateStatusLine();
}
