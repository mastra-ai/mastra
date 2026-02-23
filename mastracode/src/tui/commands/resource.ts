import type { SlashCommandContext } from './types.js';

export async function handleResourceCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const { state, harness } = ctx;
  const sub = args[0]?.trim();
  const current = harness.getResourceId();
  const defaultId = harness.getDefaultResourceId();

  if (!sub) {
    const knownIds = await harness.getKnownResourceIds();
    const isOverridden = current !== defaultId;
    const lines = [
      `Current: ${current}${isOverridden ? ` (auto-detected: ${defaultId})` : ''}`,
      '',
      'Known resource IDs:',
      ...knownIds.map((id: string) => `  ${id === current ? '* ' : '  '}${id}`),
      '',
      'Usage:',
      '  /resource <id>    - Switch to a resource ID',
      '  /resource reset   - Reset to auto-detected ID',
    ];
    ctx.showInfo(lines.join('\n'));
    return;
  }

  const newId = sub === 'reset' ? defaultId : args.join(' ').trim();
  harness.setResourceId({ resourceId: newId });

  state.pendingNewThread = true;
  state.chatContainer.clear();
  state.pendingTools.clear();
  state.toolInputBuffers.clear();
  state.allToolComponents = [];
  ctx.resetStatusLineState();
  state.ui.requestRender();

  ctx.showInfo(sub === 'reset' ? `Resource ID reset to: ${defaultId}` : `Switched to resource: ${newId}`);
}
