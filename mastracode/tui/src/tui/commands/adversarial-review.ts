/**
 * /adversarial-review — run a PR review in a spawned headless MastraCode
 * instance on a fresh thread, optionally with a different model than the
 * current session. The idea: after opening a PR, get a second opinion from
 * another model that has no context from (and no bias toward) the work done
 * in this session.
 */
import { spawn } from 'node:child_process';

import { Container, Markdown, Text } from '@earendil-works/pi-tui';
import { insertChatComponentWithBoundarySpacing } from '../chat-boundary-reconciliation.js';
import type { ChatSpacingKind } from '../components/chat-spacing.js';
import { SimpleProgressComponent } from '../components/simple-progress.js';
import { SlashCommandComponent } from '../components/slash-command.js';
import { sanitizeAnsiForRendering } from '../sanitize-ansi.js';
import { CHAT_INDENT, getMarkdownTheme, theme } from '../theme.js';
import type { SlashCommandContext } from './types.js';

/** Hard cap for the headless child run (seconds). */
const REVIEW_TIMEOUT_SECONDS = 900;

class AdversarialReviewOutputComponent extends Container {
  constructor(header: string, markdownText: string) {
    super();
    this.addChild(new Text(theme.fg('muted', header), 1, 0));
    this.addChild(
      new Markdown(sanitizeAnsiForRendering(markdownText.trim()), CHAT_INDENT, 0, getMarkdownTheme(), {
        color: (text: string) => theme.fg('text', text),
      }),
    );
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'assistant-message';
  }
}

export interface AdversarialReviewArgs {
  prNumber?: string;
  model?: string;
}

/**
 * Parse positional args: a numeric token (optionally `#`-prefixed) is the PR
 * number; the first non-numeric token is the model id. Order-independent.
 */
export function parseAdversarialReviewArgs(args: string[]): AdversarialReviewArgs {
  const parsed: AdversarialReviewArgs = {};
  for (const arg of args) {
    const normalized = arg.replace(/^#/, '');
    if (/^\d+$/.test(normalized) && parsed.prNumber === undefined) {
      parsed.prNumber = normalized;
    } else if (parsed.model === undefined) {
      parsed.model = arg;
    }
  }
  return parsed;
}

export function buildAdversarialReviewPrompt(prNumber?: string): string {
  const target = prNumber
    ? `Review PR #${prNumber}.`
    : `Find the open pull request for the current branch by running \`gh pr view --json number,title,url\`. ` +
      `If there is no PR for the current branch, state that clearly and stop. Then review that PR.`;

  return (
    `You are performing an ADVERSARIAL code review. You did not write this code; ` +
    `your job is to find real problems the author missed. Be skeptical and rigorous, ` +
    `but honest — do not invent issues that don't exist.\n\n` +
    `${target}\n\n` +
    `This is a READ-ONLY review: do not modify any files, do not commit, do not push, ` +
    `and do not comment on the PR.\n\n` +
    `Steps:\n` +
    `1. Run \`gh pr view <number>\` for the PR description and metadata.\n` +
    `2. Run \`gh pr diff <number>\` for the full diff.\n` +
    `3. Run \`gh pr checks <number>\` for CI status.\n` +
    `4. Read the surrounding source files to understand the context of every change — ` +
    `do not review the diff in isolation.\n` +
    `5. Verify the claims in the PR description against what the diff actually does.\n\n` +
    `Report:\n` +
    `- Brief summary of what the PR does\n` +
    `- Bugs and correctness issues (with file/line references)\n` +
    `- Edge cases and failure modes not handled\n` +
    `- Security concerns\n` +
    `- Missing or inadequate tests\n` +
    `- Discrepancies between the PR description and the actual changes\n` +
    `- Final verdict: approve / request changes / comment, with reasoning\n\n` +
    `If the PR is solid, say so — a short review of a good PR is a valid outcome.`
  );
}

interface HeadlessReviewResult {
  status?: string;
  text?: string;
  threadId?: string;
  error?: { name?: string; message?: string };
}

/** Extract the final JSON result object from headless `--output json` stdout. */
export function parseHeadlessJsonOutput(stdout: string): HeadlessReviewResult | undefined {
  const lines = stdout.split('\n').filter(line => line.trim().startsWith('{'));
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]!) as HeadlessReviewResult;
    } catch {
      // Not JSON — keep scanning backwards.
    }
  }
  return undefined;
}

export async function handleAdversarialReviewCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const { prNumber, model } = parseAdversarialReviewArgs(args);

  // Fail fast on an unknown model before spawning a whole headless instance.
  if (model) {
    try {
      const available = await ctx.controller.listAvailableModels();
      const match = available.find((m: { id: string }) => m.id === model);
      if (!match) {
        ctx.showError(`Unknown model: "${model}". Use /models to see available model IDs.`);
        return;
      }
    } catch {
      // Model listing failed — let the headless child validate instead.
    }
  }

  const entry = process.argv[1];
  if (!entry) {
    ctx.showError('Could not determine the mastracode entry point to spawn a headless instance.');
    return;
  }

  const prompt = buildAdversarialReviewPrompt(prNumber);
  const prLabel = prNumber ? `PR #${prNumber}` : 'the current branch PR';
  const modelLabel = model ?? 'the default model';
  const title = `Adversarial review: ${prNumber ? `PR #${prNumber}` : 'current branch'}`;

  const echo = new SlashCommandComponent(
    'adversarial-review',
    `Reviewing ${prLabel} with ${modelLabel} in a fresh headless instance`,
  );
  insertChatComponentWithBoundarySpacing(ctx.state.chatContainer, echo);

  const progress = new SimpleProgressComponent({ showPercentage: false });
  progress.start(`Adversarial review of ${prLabel} running (${modelLabel})…`);
  insertChatComponentWithBoundarySpacing(ctx.state.chatContainer, progress);
  ctx.state.ui.requestRender();

  const spawnArgs = [
    ...process.execArgv,
    entry,
    '--prompt',
    prompt,
    '--output',
    'json',
    '--title',
    title,
    '--timeout',
    String(REVIEW_TIMEOUT_SECONDS),
  ];
  if (model) {
    spawnArgs.push('--model', model);
  }

  const child = spawn(process.execPath, spawnArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Keep the spinner animating while the child runs.
  const renderInterval = setInterval(() => ctx.state.ui.requestRender(), 250);
  // Don't orphan a long-running review if the TUI exits.
  const killChild = () => child.kill('SIGTERM');
  process.once('exit', killChild);

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', chunk => {
    stderr += chunk.toString();
  });

  const cleanup = () => {
    clearInterval(renderInterval);
    process.removeListener('exit', killChild);
  };

  child.on('error', error => {
    cleanup();
    progress.fail(`Adversarial review failed to start: ${error.message}`);
    ctx.state.ui.requestRender();
  });

  child.on('close', code => {
    cleanup();

    const result = parseHeadlessJsonOutput(stdout);
    const stderrTail = stderr.trim().split('\n').slice(-5).join('\n');

    if (code === 0 && result?.text) {
      progress.complete(`Adversarial review of ${prLabel} complete (${modelLabel})`);
      const header = result.threadId ? `Review thread: ${result.threadId}` : '';
      insertChatComponentWithBoundarySpacing(
        ctx.state.chatContainer,
        new AdversarialReviewOutputComponent(header, result.text),
      );
    } else {
      const detail = result?.error?.message ?? (stderrTail || `exit code ${code}`);
      progress.fail(`Adversarial review failed: ${detail}`);
    }
    ctx.state.ui.requestRender();
  });
}
