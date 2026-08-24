import { execSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { WorkspaceFilesystem, WorkspaceSandbox } from '@mastra/core/workspace';
import type { SlashCommandMetadata } from './slash-command-loader.js';

/**
 * I/O seam for slash-command template expansion. The processor never touches
 * host node:fs or child_process directly — every read and shell substitution
 * goes through this context so templates execute where their session lives.
 */
export interface SlashCommandProcessingContext {
  /** Resolve an `@path` file reference relative to the session workspace. */
  readFile(path: string): Promise<string | undefined>;
  /** Execute a `!`-backtick shell substitution inside the session workspace. */
  executeShell(command: string): Promise<{ success: boolean; stdout: string }>;
}

const SHELL_TIMEOUT_MS = 30_000;
const MAX_RETAINED_BYTES = 1024 * 1024;

/**
 * Process a slash command by replacing variables and executing shell commands
 */
export async function processSlashCommand(
  command: SlashCommandMetadata,
  args: string[],
  context: SlashCommandProcessingContext,
): Promise<string> {
  const { result: withArgs, shouldAppendRawArgs } = replaceArguments(command.template, args);
  let result = withArgs;

  // Replace shell commands
  result = await replaceShellOutput(result, context);

  // Replace file references
  result = await replaceFileReferences(result, context);

  // Append raw args after shell/file processing to avoid executing user input
  if (shouldAppendRawArgs) {
    result = result.trimEnd() + `\n\nARGUMENTS: ${args.join(' ')}`;
  }

  return result;
}

/** Host-disk processing context for local TUI sessions. */
export function createNodeSlashCommandProcessingContext(workingDir: string): SlashCommandProcessingContext {
  return {
    async readFile(filePath: string) {
      try {
        return await fs.readFile(path.resolve(workingDir, filePath), 'utf-8');
      } catch {
        return undefined;
      }
    },
    async executeShell(command: string) {
      try {
        const stdout = execSync(command, {
          cwd: workingDir,
          encoding: 'utf-8',
          timeout: SHELL_TIMEOUT_MS,
          maxBuffer: MAX_RETAINED_BYTES,
        });
        return { success: true, stdout };
      } catch {
        return { success: false, stdout: '' };
      }
    },
  };
}

interface CommandWorkspace {
  filesystem: Pick<WorkspaceFilesystem, 'readFile'> & { basePath?: string };
  sandbox?: { executeCommand?: WorkspaceSandbox['executeCommand'] };
}

/**
 * Session-workspace processing context for Factory sessions: `@file` reads go
 * through the workspace filesystem and `!`-backtick substitutions run inside
 * the workspace sandbox. There is no host fallback.
 */
export function createWorkspaceSlashCommandProcessingContext(
  workspace: CommandWorkspace,
): SlashCommandProcessingContext {
  const cwd = workspace.filesystem.basePath;
  return {
    async readFile(filePath: string) {
      try {
        const content = await workspace.filesystem.readFile(filePath, { encoding: 'utf-8' });
        return typeof content === 'string' ? content : content.toString('utf-8');
      } catch {
        return undefined;
      }
    },
    async executeShell(command: string) {
      const executeCommand = workspace.sandbox?.executeCommand?.bind(workspace.sandbox);
      if (!executeCommand) return { success: false, stdout: '' };
      try {
        const result = await executeCommand('sh', ['-c', command], {
          timeout: SHELL_TIMEOUT_MS,
          maxRetainedBytes: MAX_RETAINED_BYTES,
          ...(cwd ? { cwd } : {}),
        });
        return { success: result.success, stdout: result.stdout };
      } catch {
        return { success: false, stdout: '' };
      }
    },
  };
}

/**
 * Replace argument variables in template
 * $ARGUMENTS - all arguments joined
 * $1, $2, etc. - positional arguments
 */
function replaceArguments(template: string, args: string[]): { result: string; shouldAppendRawArgs: boolean } {
  let result = template;

  // Check if template references any argument variables
  const hasArgumentsVar = /\$ARGUMENTS/.test(template);
  const hasPositionalVar = /\$[1-9]\d*/.test(template);

  // Replace $ARGUMENTS with all args joined
  result = result.replace(/\$ARGUMENTS/g, args.join(' '));

  // Replace range arguments $1+, $2+, etc. before single positional arguments.
  args.forEach((_, index) => {
    const argNumber = index + 1;
    const pattern = new RegExp(`\\\$${argNumber}\\+`, 'g');
    result = result.replace(pattern, args.slice(index).join(' '));
  });

  // Replace positional arguments $1, $2, etc.
  args.forEach((arg, index) => {
    const pattern = new RegExp(`\\\$${index + 1}`, 'g');
    result = result.replace(pattern, arg);
  });

  // Clear unused positional and range arguments
  result = result.replace(/\$[1-9]\d*\+?/g, '');

  return {
    result,
    shouldAppendRawArgs: !hasArgumentsVar && !hasPositionalVar && args.length > 0,
  };
}

/**
 * Replace shell command references with their output
 * Format: !`command`
 */
async function replaceShellOutput(template: string, context: SlashCommandProcessingContext): Promise<string> {
  const shellPattern = /!`([^`]+)`/g;
  const matches = [...template.matchAll(shellPattern)];

  let result = template;
  for (const match of matches) {
    const [fullMatch, command] = match;
    let replacement: string;
    try {
      const outcome = await context.executeShell(command!);
      replacement = outcome.success ? outcome.stdout.trim() : `[Error: Failed to execute "${command}"]`;
    } catch {
      replacement = `[Error: Failed to execute "${command}"]`;
    }
    result = result.replace(fullMatch, replacement);
  }

  return result;
}

/**
 * Replace file references with file content
 * Format: @filename or @path/to/file
 */
async function replaceFileReferences(template: string, context: SlashCommandProcessingContext): Promise<string> {
  const filePattern = /@([\w./-]+)/g;
  const matches = [...template.matchAll(filePattern)];

  let result = template;
  for (const match of matches) {
    const [fullMatch, filePath] = match;
    try {
      const content = await context.readFile(filePath!);
      if (content === undefined) continue;
      result = result.replace(fullMatch, content);
    } catch {
      // Leave literal @mentions/search qualifiers such as @me intact when they do not resolve to files.
    }
  }

  return result;
}

/**
 * Wrap processed command output in the `<slash-command>` envelope the model
 * receives. Literal closing boundaries in user content are escaped so the
 * envelope can never terminate early.
 */
export function formatSlashCommandActivation(name: string, content: string): string {
  const escaped = content.replaceAll('</slash-command>', '&lt;/slash-command&gt;');
  return `<slash-command name="${name}">\n${escaped}\n</slash-command>`;
}

/**
 * Format a command for display in help/autocomplete
 */
export function formatCommandForDisplay(command: SlashCommandMetadata): string {
  const parts = [command.name];

  if (command.description) {
    parts.push(`- ${command.description}`);
  }

  return parts.join(' ');
}

/**
 * Group commands by namespace for display
 */
export function groupCommandsByNamespace(commands: SlashCommandMetadata[]): Map<string, SlashCommandMetadata[]> {
  const groups = new Map<string, SlashCommandMetadata[]>();

  for (const command of commands) {
    const namespace = command.namespace || command.name.split(':')[0] || 'general';

    if (!groups.has(namespace)) {
      groups.set(namespace, []);
    }

    groups.get(namespace)!.push(command);
  }

  return groups;
}
