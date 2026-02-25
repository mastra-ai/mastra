import { Spacer } from '@mariozechner/pi-tui';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import { fg } from '../theme.js';
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

  return new Promise<void>(resolve => {
    const questionComponent = new AskQuestionInlineComponent(
      {
        question: `Tag this thread with directory "${dirName}"?\n  ${fg('dim', projectPath)}`,
        options: [{ label: 'Yes' }, { label: 'No' }],
        formatResult: answer => (answer === 'Yes' ? `Tagged thread with: ${dirName}` : `Thread not tagged`),
        onSubmit: async answer => {
          state.activeInlineQuestion = undefined;
          if (answer.toLowerCase().startsWith('y')) {
            await state.harness.setThreadSetting({ key: 'projectPath', value: projectPath });
          }
          resolve();
        },
        onCancel: () => {
          state.activeInlineQuestion = undefined;
          resolve();
        },
      },
      state.ui,
    );

    state.activeInlineQuestion = questionComponent;
    state.chatContainer.addChild(new Spacer(1));
    state.chatContainer.addChild(questionComponent);
    state.chatContainer.addChild(new Spacer(1));
    state.ui.requestRender();
    state.chatContainer.invalidate();
  });
}
