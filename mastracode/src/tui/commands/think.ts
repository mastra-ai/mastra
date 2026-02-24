import type { SlashCommandContext } from './types.js';

export async function handleThinkCommand(ctx: SlashCommandContext): Promise<void> {
  const currentLevel = ((ctx.harness.getState() as any)?.thinkingLevel ?? 'off') as string;
  const levels = [
    { label: 'Off', id: 'off' },
    { label: 'Minimal', id: 'minimal' },
    { label: 'Low', id: 'low' },
    { label: 'Medium', id: 'medium' },
    { label: 'High', id: 'high' },
  ];
  const currentIdx = levels.findIndex(l => l.id === currentLevel);
  const nextIdx = (currentIdx + 1) % levels.length;
  const next = levels[nextIdx]!;
  await ctx.harness.setState({ thinkingLevel: next.id } as any);
  ctx.showInfo(`Thinking: ${next.label}`);
  ctx.updateStatusLine();
}
