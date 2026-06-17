import { askModalQuestion } from '../modal-question.js';
import { theme } from '../theme.js';
import type { SlashCommandContext } from './types.js';

export async function handleThreadTagDirCommand(ctx: SlashCommandContext): Promise<void> {
  const { state } = ctx;
  const threadId = state.harness.getCurrentThreadId();
  if (!threadId && state.pendingNewThread) {
    ctx.showInfo('No active thread yet — send a message first.');
    return;
  }
  if (!threadId) {
    ctx.showInfo('No active thread.');
    return;
  }

  const projectPath = (state.harness.getState() as any)?.projectPath as string | undefined;
  if (!projectPath) {
    ctx.showInfo('Could not detect current project path.');
    return;
  }

  const dirName = projectPath.split('/').pop() || projectPath;

  const answer = await askModalQuestion(state.ui, {
    question: `Tag this thread with directory "${dirName}"?\n  ${theme.fg('dim', projectPath)}`,
    options: [{ label: 'Yes' }, { label: 'No' }],
  });
  if (answer?.toLowerCase().startsWith('y')) {
    await state.harness.setThreadSetting({ key: 'projectPath', value: projectPath });
  }
}
