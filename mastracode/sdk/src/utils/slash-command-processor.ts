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
 * against the host working directory. Retained as the published entry point;
 * context-aware callers use {@link processSlashCommandWithContext} directly.
 */
export async function processSlashCommand(
  command: SlashCommandMetadata,
  args: string[],
  workingDir: string,
): Promise<string> {
  return processSlashCommandWithContext(command, args, createNodeSlashCommandProcessingContext(workingDir));
}

/**
 * Process a slash command with explicit I/O — the form Factory sessions use so
 * `@file` reads and shell substitutions execute in the addressed workspace.
 *
 * The template is parsed into segments first; arguments are substituted into
 * those recognized segments only. Argument text can therefore never introduce
 * a new shell or file directive, and values reaching an existing shell
 * directive are POSIX-quoted before execution.
 */
export async function processSlashCommandWithContext(
  command: SlashCommandMetadata,
  args: string[],
  context: SlashCommandProcessingContext,
): Promise<string> {
  const segments = parseTemplateSegments(command.template);
  const hasArgumentsVar = /\$ARGUMENTS/.test(command.template);
  const hasPositionalVar = /\$[1-9]\d*/.test(command.template);
  const shouldAppendRawArgs = !hasArgumentsVar && !hasPositionalVar && args.length > 0;

  const parts: string[] = [];
  for (const segment of segments) {
    if (segment.kind === 'text') {
      parts.push(substituteArguments(segment.value, args));
    } else if (segment.kind === 'shell') {
      parts.push(await expandShellSegment(segment.command, args, context));
    } else {
      parts.push(await expandFileSegment(segment.path, args, context));
    }
  }

  let result = parts.join('');
  // Append raw args after shell/file processing to avoid executing user input
  if (shouldAppendRawArgs) {
    result = result.trimEnd() + `\n\nARGUMENTS: ${args.join(' ')}`;
  }
  return result;
}

type TemplateSegment =
  | { kind: 'text'; value: string }
  | { kind: 'shell'; command: string }
  | { kind: 'file'; path: string };

const SHELL_SEGMENT = /!`([^`]+)`/;
const FILE_SEGMENT = /@([\w./-]+)/;

/** Split a template at its literal `!`-backtick and `@path` directives. */
export function parseTemplateSegments(template: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let rest = template;
  for (;;) {
    const shell = SHELL_SEGMENT.exec(rest);
    const file = FILE_SEGMENT.exec(rest);
    const shellIndex = shell?.index ?? Number.POSITIVE_INFINITY;
    const fileIndex = file?.index ?? Number.POSITIVE_INFINITY;

    if (shellIndex < fileIndex && shell) {
      if (shell.index > 0) segments.push({ kind: 'text', value: rest.slice(0, shell.index) });
      segments.push({ kind: 'shell', command: shell[1]! });
      rest = rest.slice(shell.index + shell[0].length);
    } else if (file) {
      if (file.index > 0) segments.push({ kind: 'text', value: rest.slice(0, file.index) });
      segments.push({ kind: 'file', path: file[1]! });
      rest = rest.slice(file.index + file[0].length);
    } else {
      break;
    }
  }
  if (rest) segments.push({ kind: 'text', value: rest });
  return segments;
}

/**
 * Replace argument variables in one template segment.
 * $ARGUMENTS - all arguments joined
 * $1, $2, etc. - positional arguments; $N+ - range to the end
 */
function substituteArguments(text: string, args: string[]): string {
  let result = text.replace(/\$ARGUMENTS/g, args.join(' '));

  args.forEach((_, index) => {
    const pattern = new RegExp(`\\\$${index + 1}\\+`, 'g');
    result = result.replace(pattern, args.slice(index).join(' '));
  });

  args.forEach((arg, index) => {
    const pattern = new RegExp(`\\\$${index + 1}`, 'g');
    result = result.replace(pattern, arg);
  });

  // Clear unused positional and range arguments
  return result.replace(/\$[1-9]\d*\+?/g, '');
}

/** Quote one value as a single POSIX shell word. */
function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/** True when the directive itself references argument placeholders. */
function referencesArguments(directive: string): boolean {
  return /\$ARGUMENTS|\$[1-9]\d*\+?/.test(directive);
}

async function expandShellSegment(
  directive: string,
  args: string[],
  context: SlashCommandProcessingContext,
): Promise<string> {
  // Only an already-recognized directive receives argument values, and they
  // are quoted so no argument text can break out into new shell syntax.
  const commandToRun = referencesArguments(directive)
    ? substituteArguments(directive, args.map(shellQuote))
    : directive;

  let replacement: string;
  try {
    const outcome = await context.executeShell(commandToRun);
    replacement = outcome.success ? outcome.stdout.trim() : `[Error: Failed to execute "${directive}"]`;
  } catch {
    replacement = `[Error: Failed to execute "${directive}"]`;
  }
  return replacement;
}

async function expandFileSegment(
  reference: string,
  args: string[],
  context: SlashCommandProcessingContext,
): Promise<string> {
  // Paths may reference positional args (e.g. `@$1`) but stay literal when the
  // reference does not resolve — @mentions like @me must survive untouched.
  try {
    const content = await context.readFile(substituteArguments(reference, args));
    if (content !== undefined) return content;
  } catch {
    // fall through to the literal
  }
  return `@${reference}`;
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
