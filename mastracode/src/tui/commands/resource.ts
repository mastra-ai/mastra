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
      '  /resource          - Show current resource and known IDs',
      '  /resource <id>     - Switch to a resource ID (resumes latest thread)',
      '  /resource reset    - Reset to auto-detected ID',
    ];
    ctx.showInfo(lines.join('\n'));
    return;
  }

  const newId = sub === 'reset' ? defaultId : args.join(' ').trim();

  if (newId === current) {
    ctx.showInfo(`Already on resource: ${current}`);
    return;
  }

  harness.setResourceId({ resourceId: newId });

  // Try to resume the most recent thread for this resource
  const threads = await harness.listThreads();
  const latest = [...threads].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

  if (latest) {
    await harness.switchThread({ threadId: latest.id });
    state.chatContainer.clear();
    state.pendingTools.clear();
    state.allToolComponents = [];
    state.allSystemReminderComponents = [];
    state.allShellComponents = [];
    state.pendingNewThread = false;
    await ctx.renderExistingMessages();
    ctx.showInfo(
      sub === 'reset'
        ? `Resource ID reset to: ${defaultId} — resumed thread: ${latest.title || latest.id}`
        : `Switched to resource: ${newId} — resumed thread: ${latest.title || latest.id}`,
    );
  } else {
    state.chatContainer.clear();
    state.pendingTools.clear();
    state.allToolComponents = [];
    state.allSystemReminderComponents = [];
    state.allShellComponents = [];
    state.pendingNewThread = true;
    ctx.showInfo(
      sub === 'reset'
        ? `Resource ID reset to: ${defaultId} (no existing threads, a new one will be created)`
        : `Switched to resource: ${newId} (no existing threads, a new one will be created)`,
    );
  }

  ctx.updateStatusLine();
  state.ui.requestRender();
}
