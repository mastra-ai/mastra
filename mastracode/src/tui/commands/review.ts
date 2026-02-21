import type { SlashCommandContext } from './types.js';

export async function handleReviewCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  if (!ctx.state.harness.hasModelSelected()) {
    ctx.showInfo('No model selected. Use /models to select a model, or /login to authenticate.');
    return;
  }

  // Ensure thread exists
  if (ctx.state.pendingNewThread) {
    await ctx.state.harness.createThread();
    ctx.state.pendingNewThread = false;
    ctx.updateStatusLine();
  }

  const prNumber = args[0];
  const focusArea = args.slice(1).join(' ');

  let prompt: string;

  if (!prNumber) {
    prompt =
      `List the open pull requests for this repository using \`gh pr list --limit 20\`. ` +
      `Present them in a clear table with PR number, title, and author. ` +
      `Then ask me which PR I'd like you to review.`;
  } else {
    prompt =
      `Do a thorough code review of PR #${prNumber}. Follow these steps:\n\n` +
      `1. Run \`gh pr view ${prNumber}\` to get the PR description and metadata.\n` +
      `2. Run \`gh pr diff ${prNumber}\` to get the full diff.\n` +
      `3. Run \`gh pr checks ${prNumber}\` to check CI status.\n` +
      `4. Read any relevant source files for full context on the changes.\n` +
      `5. Provide a detailed code review covering:\n` +
      `   - Overview of what the PR does\n` +
      `   - Root cause analysis (if it's a fix)\n` +
      `   - Code quality assessment\n` +
      `   - Potential concerns or edge cases\n` +
      `   - CI status\n` +
      `   - Suggestions for improvement\n` +
      `   - Final verdict (approve/request changes/comment)\n`;

    if (focusArea) {
      prompt += `\nPay special attention to: ${focusArea}\n`;
    }
  }

  ctx.addUserMessage({
    id: `user-${Date.now()}`,
    role: 'user',
    content: [
      {
        type: 'text',
        text: prNumber ? `/review ${args.join(' ')}` : '/review',
      },
    ],
    createdAt: new Date(),
  });
  ctx.state.ui.requestRender();

  ctx.state.harness.sendMessage({ content: prompt }).catch(error => {
    ctx.showError(error instanceof Error ? error.message : 'Review failed');
  });
}
