import { Spacer } from '@mariozechner/pi-tui';
import type { HarnessMessage } from '@mastra/core/harness';
import { ThreadLockError } from '../../utils/thread-lock.js';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import { ThreadSelectorComponent } from '../components/thread-selector.js';
import type { SlashCommandContext } from './types.js';

function extractTextContent(message: HarnessMessage): string {
  return message.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join(' ')
    .trim();
}

function truncatePreview(text: string, maxLength = 50): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function showThreadLockPrompt(ctx: SlashCommandContext, threadTitle: string, ownerPid: number): void {
  const questionComponent = new AskQuestionInlineComponent(
    {
      question: `Thread "${threadTitle}" is locked by pid ${ownerPid}. Create a new thread?`,
      options: [
        { label: 'Yes', description: 'Start a new thread' },
        { label: 'No', description: 'Exit' },
      ],
      formatResult: answer => (answer === 'Yes' ? 'Thread created' : 'Exiting.'),
      onSubmit: async answer => {
        ctx.state.activeInlineQuestion = undefined;
        if (!answer.toLowerCase().startsWith('y')) {
          process.exit(0);
        }
      },
      onCancel: () => {
        ctx.state.activeInlineQuestion = undefined;
        process.exit(0);
      },
    },
    ctx.state.ui,
  );

  ctx.state.activeInlineQuestion = questionComponent;
  ctx.state.chatContainer.addChild(questionComponent);
  ctx.state.chatContainer.addChild(new Spacer(1));
  ctx.state.ui.requestRender();
  ctx.state.chatContainer.invalidate();
}

export async function handleThreadsCommand(ctx: SlashCommandContext): Promise<void> {
  const { state } = ctx;
  const threads = await state.harness.listThreads({ allResources: true });
  const currentId = state.pendingNewThread ? null : state.harness.getCurrentThreadId();
  const currentResourceId = state.harness.getResourceId();

  if (threads.length === 0) {
    ctx.showInfo('No threads yet. Send a message to create one.');
    return;
  }

  return new Promise(resolve => {
    const selector = new ThreadSelectorComponent({
      tui: state.ui,
      threads,
      currentThreadId: currentId,
      currentResourceId,
      getMessagePreview: async (threadId: string) => {
        const firstUserMessage = await state.harness.getFirstUserMessageForThread({ threadId });
        if (firstUserMessage) {
          const text = extractTextContent(firstUserMessage);
          return truncatePreview(text);
        }
        return null;
      },
      onSelect: async thread => {
        state.ui.hideOverlay();

        if (thread.id === currentId) {
          resolve();
          return;
        }

        if (thread.resourceId !== currentResourceId) {
          state.harness.setResourceId({ resourceId: thread.resourceId });
        }
        try {
          await state.harness.switchThread({ threadId: thread.id });
        } catch (error) {
          if (error instanceof ThreadLockError) {
            showThreadLockPrompt(ctx, thread.title || thread.id, error.ownerPid);
          } else {
            ctx.showError(`Failed to switch thread: ${error instanceof Error ? error.message : String(error)}`);
          }
          resolve();
          return;
        }
        state.pendingNewThread = false;

        state.chatContainer.clear();
        state.allToolComponents = [];
        state.pendingTools.clear();
        state.toolInputBuffers.clear();
        await ctx.renderExistingMessages();
        ctx.updateStatusLine();

        ctx.showInfo(`Switched to: ${thread.title || thread.id}`);
        resolve();
      },
      onCancel: () => {
        state.ui.hideOverlay();
        resolve();
      },
    });

    state.ui.showOverlay(selector, {
      width: '80%',
      maxHeight: '60%',
      anchor: 'center',
    });
    selector.focused = true;
  });
}
