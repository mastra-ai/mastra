import { readHarnessState, writeHarnessState } from '../../utils/harness-state.js';
import type { SlashCommandContext } from './types.js';

export function handleYoloCommand(ctx: SlashCommandContext): void {
  const current = (readHarnessState(ctx.harness) as any)?.yolo === true;
  void writeHarnessState(ctx.harness, { yolo: !current } as any);
  ctx.showInfo(!current ? 'YOLO mode ON — tools auto-approved' : 'YOLO mode OFF — tools require approval');
}
