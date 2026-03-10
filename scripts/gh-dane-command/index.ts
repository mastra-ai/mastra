/**
 * GitHub Actions runner script for @dane-ai-mastra PR commands.
 *
 * Reads a command name and PR number from environment variables,
 * loads the corresponding .claude/commands/ template, processes it,
 * and sends it to a headless MastraCode harness for execution.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createMastraCode } from '../../mastracode/src/index.js';
import { runHeadless } from '../../mastracode/src/headless.js';
import { processSlashCommand } from '../../mastracode/src/utils/slash-command-processor.js';
import type { SlashCommandMetadata } from '../../mastracode/src/utils/slash-command-loader.js';
import { releaseAllThreadLocks } from '../../mastracode/src/utils/thread-lock.js';
import { setupDebugLogging } from '../../mastracode/src/utils/debug-log.js';

// Supported commands and their corresponding .claude/commands/ file names
const SUPPORTED_COMMANDS: Record<string, string> = {
  'fix-ci': 'gh-fix-ci',
  'fix-lint': 'gh-fix-lint',
  'pr-comments': 'gh-pr-comments',
  'merge-main': '',
};

// Commands with inline prompts instead of .claude/commands/ templates
const INLINE_PROMPTS: Record<string, string> = {
  'merge-main': `Please merge latest origin/main in and fix conflicts to the best of your ability. If you are struggling with fixing conflicts please throw an error and stop saying that the conflicts are too complex to fix without making mistakes.`,
};

async function main(): Promise<never> {
  const commandName = process.env.COMMAND_NAME;
  const prNumber = process.env.PR_NUMBER;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!commandName) {
    console.error('Error: COMMAND_NAME environment variable is required');
    process.exit(1);
  }
  if (!prNumber || !/^\d+$/.test(prNumber)) {
    console.error('Error: PR_NUMBER environment variable must be a positive integer');
    process.exit(1);
  }
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  const commandFileName = SUPPORTED_COMMANDS[commandName];
  if (commandFileName === undefined) {
    const available = Object.keys(SUPPORTED_COMMANDS).join(', ');
    console.error(`Error: Unknown command "${commandName}". Available commands: ${available}`);
    process.exit(1);
  }

  // Trusted repo root = where this script lives (default branch checkout)
  // PR workspace = where the AI agent will operate (PR branch checkout)
  const trustedRoot = resolve(import.meta.dirname, '..', '..');
  const prWorkspace = process.env.PR_WORKSPACE || trustedRoot;

  let prompt: string;

  if (INLINE_PROMPTS[commandName]) {
    // Inline prompt — no template file needed
    prompt = INLINE_PROMPTS[commandName];
  } else {
    // Load the command template from TRUSTED code, not the PR branch
    const commandPath = resolve(trustedRoot, '.claude', 'commands', `${commandFileName}.md`);

    let template: string;
    try {
      template = readFileSync(commandPath, 'utf-8');
    } catch (err) {
      console.error(`Error: Could not read command file at ${commandPath}: ${err}`);
      process.exit(1);
    }

    // Process the template (replaces $ARGUMENTS, $1, !`shell`, @file references)
    const commandMeta: SlashCommandMetadata = {
      name: commandFileName,
      description: '',
      template,
      sourcePath: commandPath,
    };

    const args = [prNumber];
    prompt = await processSlashCommand(commandMeta, args, trustedRoot);
  }

  console.log(`Running command: ${commandName} (file: ${commandFileName}.md)`);
  console.log(`PR: #${prNumber}`);
  console.log(`Trusted root: ${trustedRoot}`);
  console.log(`PR workspace: ${prWorkspace}`);
  console.log('---');

  // Initialize MastraCode with yolo mode (auto-approve everything)
  // cwd points to the PR workspace so the AI agent operates on the PR branch,
  // while this script and all imports come from the trusted default branch.
  const result = await createMastraCode({ cwd: prWorkspace, initialState: { yolo: true } });
  const { harness, mcpManager, authStorage } = result;

  // Inject the Anthropic API key into auth storage
  authStorage.set('anthropic', { type: 'api_key', key: apiKey });

  if (mcpManager?.hasServers()) {
    await mcpManager.init();
  }

  setupDebugLogging();
  await harness.init();

  // Run headless with a 10 minute timeout
  const exitCode = await runHeadless(harness, {
    prompt,
    format: 'default',
    continue_: false,
    timeout: 600,
  });

  // Cleanup
  releaseAllThreadLocks();
  await Promise.allSettled([mcpManager?.disconnect(), harness?.stopHeartbeats()]);

  process.exit(exitCode);
}

main().catch(error => {
  console.error('Fatal error:', error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
