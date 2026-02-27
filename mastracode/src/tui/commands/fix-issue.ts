import fs from 'node:fs';
import path from 'node:path';
import { getAppDataDir } from '../../utils/project.js';
import type { SlashCommandContext } from './types.js';

function getRepoDir(): string {
  return path.join(getAppDataDir(), 'repos', 'mastra');
}

export async function handleFixIssueCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  if (!ctx.state.harness.hasModelSelected()) {
    ctx.showInfo('No model selected. Use /models to select a model, or /login to authenticate.');
    return;
  }

  // Ensure thread exists
  if (ctx.state.pendingNewThread) {
    await ctx.state.harness.createThread();
    ctx.state.pendingNewThread = false;
  }

  const issueNumber = args[0];
  let prompt: string;

  if (!issueNumber) {
    // List mode: show open mastracode issues
    prompt =
      `List the open GitHub issues labeled \`mastracode\` in the mastra repo. Run:\n\n` +
      '```\n' +
      `gh issue list --repo mastra-ai/mastra --label mastracode --state open --limit 30 --json number,title,author,labels,createdAt\n` +
      '```\n\n' +
      `Present them in a clear table with issue number, title, and author. ` +
      `Then ask me which issue I'd like to fix.`;
  } else {
    const repoDir = getRepoDir();
    const repoExists = fs.existsSync(path.join(repoDir, '.git'));

    // Add the repo directory to the sandbox so the agent can work in it
    const harnessState = ctx.state.harness.getState() as { sandboxAllowedPaths?: string[] };
    const currentPaths = harnessState.sandboxAllowedPaths ?? [];
    if (!currentPaths.includes(repoDir)) {
      const parentDir = path.dirname(repoDir);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      const updated = [...currentPaths, repoDir];
      ctx.state.harness.setState({ sandboxAllowedPaths: updated } as any);
      await ctx.state.harness.setThreadSetting({ key: 'sandboxAllowedPaths', value: updated });
    }

    prompt =
      `Fix GitHub issue #${issueNumber} from the mastra repo. Follow these stages in order — complete each fully before moving on.\n\n` +
      `## Stage 1: Setup\n\n` +
      `The work directory is: \`${repoDir}\`\n\n` +
      (repoExists
        ? `The repo already exists. Run these commands:\n` +
          '```\n' +
          `cd ${repoDir}\n` +
          `git fetch origin\n` +
          `git checkout -B fix/issue-${issueNumber} origin/main\n` +
          '```\n'
        : `Clone the repo first:\n` +
          '```\n' +
          `git clone https://github.com/mastra-ai/mastra.git ${repoDir}\n` +
          `cd ${repoDir}\n` +
          `git checkout -b fix/issue-${issueNumber} origin/main\n` +
          '```\n') +
      `\nThen install and build:\n` +
      '```\n' +
      `cd ${repoDir}\n` +
      `pnpm install\n` +
      `pnpm build\n` +
      '```\n' +
      `The build can take a few minutes. Wait for it to finish.\n\n` +
      `## Stage 2: Analyze\n\n` +
      `Fetch the issue details:\n` +
      '```\n' +
      `gh issue view ${issueNumber} --repo mastra-ai/mastra --json title,body,comments,labels,assignees\n` +
      '```\n\n' +
      `Analyze the issue thoroughly:\n` +
      `1. The issue description and requirements\n` +
      `2. Any linked PRs or related issues\n` +
      `3. Comments and discussion threads\n` +
      `4. Labels and metadata\n\n` +
      `Summarize your findings and ask me if your understanding is correct before proceeding.\n\n` +
      `## Stage 3: Reproduce\n\n` +
      `1. Explore the codebase in \`${repoDir}\` to find the relevant code\n` +
      `2. Find related tests and understand how the feature works\n` +
      `3. Write a failing test that reproduces the issue. The test should be generalized (not issue-specific) and fit the repo's testing patterns\n` +
      `4. Run the test to confirm it fails for the right reason\n` +
      `5. Explain the failing test to me — I must agree it reproduces the issue\n\n` +
      `## Stage 4: Fix\n\n` +
      `1. Commit the failing test first\n` +
      `2. Propose a fix plan and get my agreement\n` +
      `3. Implement the fix\n` +
      `4. Run the failing test to confirm it passes now\n` +
      `5. Run the broader test suite for the affected package to check for regressions\n` +
      `6. Explain the fix to me\n\n` +
      `## Stage 5: PR\n\n` +
      `1. Commit the fix with a descriptive message (use conventional commits, e.g. \`fix(package): description\`)\n` +
      `2. Push the branch:\n` +
      '```\n' +
      `cd ${repoDir}\n` +
      `git push origin fix/issue-${issueNumber}\n` +
      '```\n' +
      `3. Open a PR:\n` +
      '```\n' +
      `gh pr create --repo mastra-ai/mastra --base main --head fix/issue-${issueNumber} --label mastracode --title \"fix: <concise description>\" --body \"<description of the fix, what was wrong, and how it was fixed. Reference #${issueNumber}>\"\\n` +
      '```\n' +
      `4. Report the PR URL to me\n`;
  }

  ctx.addUserMessage({
    id: `user-${Date.now()}`,
    role: 'user',
    content: [
      {
        type: 'text',
        text: issueNumber ? `/fix-issue ${issueNumber}` : '/fix-issue',
      },
    ],
    createdAt: new Date(),
  });
  ctx.state.ui.requestRender();

  ctx.state.harness.sendMessage({ content: prompt }).catch(error => {
    ctx.showError(error instanceof Error ? error.message : 'Fix issue failed');
  });
}
