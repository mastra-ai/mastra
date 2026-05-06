import type { SlashCommandContext } from './types.js';

const MASTRA_REPO = 'mastra-ai/mastra';
const MASTRA_LABEL = 'mastracode';

export async function handleReportIssueCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  if (!ctx.state.harness.hasModelSelected()) {
    ctx.showInfo('No model selected. Use /models to select a model, or /login to authenticate.');
    return;
  }

  // Ensure thread exists
  if (ctx.state.pendingNewThread) {
    await ctx.state.harness.createThread();
    ctx.state.pendingNewThread = false;
  }

  const extraContext = args.join(' ').trim();

  const prompt =
    `The user wants to report a GitHub issue on ${MASTRA_REPO}. Help them through this process.\n\n` +
    (extraContext ? `The user provided this initial context: "${extraContext}"\n\n` : '') +
    `## Step 1: Understand the problem\n\n` +
    `Ask the user to describe the issue in their own words. Ask follow-up questions to gather:\n` +
    `- What happened / what's wrong\n` +
    `- What they expected to happen\n` +
    `- Steps to reproduce (if applicable)\n\n` +
    `Also gather environment info by running:\n` +
    '```\n' +
    `mastracode --version 2>/dev/null || echo "unknown"\n` +
    `node --version\n` +
    `uname -s\n` +
    '```\n\n' +
    `Use the conversation history for additional context about what the user was working on when they hit this issue.\n\n` +
    `## Step 2: Check for duplicates\n\n` +
    `Once you understand the problem, search for similar existing issues:\n` +
    '```\n' +
    `gh issue list --repo ${MASTRA_REPO} --label ${MASTRA_LABEL} --state open --limit 50 --json number,title,body\n` +
    '```\n\n' +
    `Also search more broadly:\n` +
    '```\n' +
    `gh search issues --repo ${MASTRA_REPO} --state open "<relevant keywords>" --limit 20 --json number,title,body,labels\n` +
    '```\n\n' +
    `If you find similar issue(s):\n` +
    `- Present them with their number, title, and a brief summary\n` +
    `- Ask the user whether they'd like to add a comment on an existing issue instead of opening a new one\n` +
    `- If they choose to comment, draft the comment, show it to the user for approval, then run:\n` +
    '```\n' +
    `gh issue comment <number> --repo ${MASTRA_REPO} --body "<comment>"\n` +
    '```\n' +
    `Then stop here.\n\n` +
    `## Step 3: Draft the issue\n\n` +
    `Based on what you've gathered, write a clear, well-structured issue with:\n` +
    `- A concise, descriptive title\n` +
    `- A body covering: description, expected behavior, steps to reproduce, and environment info\n\n` +
    `**Show the full title and body to the user and ask for their approval before creating it.** Let them suggest edits.\n\n` +
    `## Step 4: Create the issue\n\n` +
    `Only after the user approves, create the issue:\n` +
    '```\n' +
    `gh issue create --repo ${MASTRA_REPO} --label ${MASTRA_LABEL} --title "<title>" --body "<body>"\n` +
    '```\n\n' +
    `Report the created issue URL back to the user.`;

  ctx.addUserMessage({
    id: `user-${Date.now()}`,
    role: 'user',
    content: [
      {
        type: 'text',
        text: extraContext ? `/report-issue ${extraContext}` : '/report-issue',
      },
    ],
    createdAt: new Date(),
  });
  ctx.state.ui.requestRender();

  ctx.state.harness.sendMessage({ content: prompt }).catch(error => {
    ctx.showError(error instanceof Error ? error.message : 'Report issue command failed');
  });
}
