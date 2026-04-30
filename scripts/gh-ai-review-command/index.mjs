#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_CONTEXT_CHARS = 120_000;
const MAX_DIFF_CHARS = 70_000;
const MAX_AGENT_OUTPUT_CHARS = 58_000;

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function truncate(value, maxChars) {
  if (!value || value.length <= maxChars) return value || '';
  return `${value.slice(0, maxChars)}\n\n[truncated ${value.length - maxChars} chars]`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    input: options.input,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, ...(options.env || {}) },
  });

  if (result.error) {
    throw result.error;
  }

  return {
    status: result.status ?? 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function gh(args) {
  const result = run('gh', args);
  if (result.status !== 0) {
    throw new Error(`gh ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function ghJson(args) {
  const raw = gh(args);
  return raw.trim() ? JSON.parse(raw) : null;
}

function shellQuoteForDisplay(value) {
  return value.replace(/[^a-zA-Z0-9_./:@-]/g, '');
}

function readIssueContext(repo, issueNumber) {
  const issue = ghJson([
    'issue',
    'view',
    issueNumber,
    '--repo',
    repo,
    '--json',
    'number,title,body,state,author,labels,comments,url,createdAt,updatedAt',
  ]);

  let pr = null;
  let diff = '';
  try {
    pr = ghJson([
      'pr',
      'view',
      issueNumber,
      '--repo',
      repo,
      '--json',
      [
        'number',
        'title',
        'body',
        'state',
        'author',
        'baseRefName',
        'headRefName',
        'headRepository',
        'headRepositoryOwner',
        'isCrossRepository',
        'isDraft',
        'reviewDecision',
        'files',
        'commits',
        'url',
        'createdAt',
        'updatedAt',
      ].join(','),
    ]);
    diff = gh(['pr', 'diff', issueNumber, '--repo', repo]);
  } catch {
    pr = null;
  }

  return { issue, pr, diff: truncate(diff, MAX_DIFF_CHARS) };
}

function buildPrompt({ agent, command, repo, issueNumber, commentBody, issue, pr, diff }) {
  const modeInstructions = {
    review:
      'Review the issue or PR. Lead with concrete findings, correctness risks, missing tests, and whether the proposed diagnosis matches the code.',
    plan:
      'Create an implementation plan. Keep it concrete: files to inspect/change, minimal fix shape, tests, and rollout risks.',
    risks:
      'Focus only on risks and edge cases. Identify false assumptions, regression risks, and missing validation.',
    tests:
      'Focus only on test strategy. Propose exact focused tests and what each should prove.',
  };

  const context = {
    repository: repo,
    issueNumber,
    requestedAgent: agent,
    requestedCommand: command,
    triggeringComment: commentBody,
    issue,
    pullRequest: pr,
    pullRequestDiff: diff,
  };

  return truncate(
    `You are running as a fork-only GitHub issue/PR assistant for ${repo}.

Rules:
- Do not edit files, commit, push, or call external services.
- Use the checked-out repository as source context if you inspect files.
- Do not expose secrets or environment variables.
- Keep the final response suitable for a GitHub issue comment.
- Be concise but specific.
- If the evidence is insufficient, say exactly what is missing.

Task:
${modeInstructions[command] || modeInstructions.review}

GitHub context:
${JSON.stringify(context, null, 2)}
`,
    MAX_CONTEXT_CHARS,
  );
}

function requireSecret(agent) {
  if (agent === 'codex' && !env('OPENAI_API_KEY')) {
    throw new Error('Missing OPENAI_API_KEY secret for @codex commands.');
  }
  if (agent === 'claude' && !env('ANTHROPIC_API_KEY')) {
    throw new Error('Missing ANTHROPIC_API_KEY secret for @claude commands.');
  }
  if (agent === 'gemini' && !env('GEMINI_API_KEY') && !env('GOOGLE_API_KEY')) {
    throw new Error('Missing GEMINI_API_KEY secret for @gemini commands.');
  }
}

function runAgent(agent, prompt) {
  requireSecret(agent);

  if (agent === 'codex') {
    const outputFile = join(tmpdir(), `codex-output-${Date.now()}.md`);
    const result = run('codex', [
      'exec',
      '--sandbox',
      'read-only',
      '--cd',
      process.cwd(),
      '--output-last-message',
      outputFile,
      '-',
    ], { input: prompt });
    const output = existsSync(outputFile) ? readFileSync(outputFile, 'utf8') : result.stdout;
    if (result.status !== 0) {
      throw new Error(`codex failed:\n${result.stderr || result.stdout || output}`);
    }
    return output;
  }

  if (agent === 'claude') {
    const result = run('claude', [
      '--print',
      '--permission-mode',
      'plan',
      '--output-format',
      'text',
      prompt,
    ]);
    if (result.status !== 0) {
      throw new Error(`claude failed:\n${result.stderr || result.stdout}`);
    }
    return result.stdout;
  }

  if (agent === 'gemini') {
    const result = run('gemini', [
      '--approval-mode',
      'plan',
      '--skip-trust',
      '--prompt',
      prompt,
    ]);
    if (result.status !== 0) {
      throw new Error(`gemini failed:\n${result.stderr || result.stdout}`);
    }
    return result.stdout;
  }

  throw new Error(`Unsupported agent: ${agent}`);
}

function main() {
  const agent = env('AI_AGENT');
  const command = env('AI_COMMAND');
  const repo = env('REPOSITORY', env('GITHUB_REPOSITORY'));
  const issueNumber = env('ISSUE_NUMBER');
  const outputFile = env('AI_OUTPUT_FILE', 'ai-review-output.md');
  const commentBody = env('COMMENT_BODY');
  const runUrl = env('RUN_URL');

  if (!agent || !command || !repo || !issueNumber) {
    throw new Error('Missing required AI_AGENT, AI_COMMAND, REPOSITORY, or ISSUE_NUMBER environment.');
  }

  const { issue, pr, diff } = readIssueContext(repo, issueNumber);
  const prompt = buildPrompt({ agent, command, repo, issueNumber, commentBody, issue, pr, diff });
  const rawOutput = runAgent(agent, prompt).trim();
  const safeAgent = shellQuoteForDisplay(agent);
  const safeCommand = shellQuoteForDisplay(command);
  const target = pr ? `PR #${issueNumber}` : `issue #${issueNumber}`;

  const body = `### @${safeAgent} ${safeCommand}

Target: ${target}

${truncate(rawOutput || '_No output returned._', MAX_AGENT_OUTPUT_CHARS)}

---
_Generated by fork-only AI review workflow${runUrl ? `: ${runUrl}` : ''}._`;

  writeFileSync(outputFile, body);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  writeFileSync(
    env('AI_OUTPUT_FILE', 'ai-review-output.md'),
    `AI command failed before posting a full review.\n\n\`\`\`text\n${truncate(message, 6000)}\n\`\`\`\n`,
  );
  console.error(message);
  process.exit(1);
}
