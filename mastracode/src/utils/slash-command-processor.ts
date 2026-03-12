import { execSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { SlashCommandMetadata } from './slash-command-loader.js';

/**
 * Process a slash command by replacing variables and executing shell commands
 */
export async function processSlashCommand(
  command: SlashCommandMetadata,
  args: string[],
  workingDir: string,
): Promise<string> {
  const { result: withArgs, shouldAppendRawArgs } = replaceArguments(command.template, args);
  let result = withArgs;

  // Replace shell commands
  result = await replaceShellOutput(result, workingDir);

  // Replace file references
  result = await replaceFileReferences(result, workingDir);

  // Append raw args after shell/file processing to avoid executing user input
  if (shouldAppendRawArgs) {
    result = result.trimEnd() + `\n\nARGUMENTS: ${args.join(' ')}`;
  }

  return result;
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

  // Replace positional arguments $1, $2, etc.
  args.forEach((arg, index) => {
    const pattern = new RegExp(`\\\$${index + 1}`, 'g');
    result = result.replace(pattern, arg);
  });

  // Clear unused positional arguments
  result = result.replace(/\$[1-9]\d*/g, '');

  return {
    result,
    shouldAppendRawArgs: !hasArgumentsVar && !hasPositionalVar && args.length > 0,
  };
}

/**
 * Replace shell command references with their output
 * Format: !`command`
 */
async function replaceShellOutput(template: string, workingDir: string): Promise<string> {
  const shellPattern = /!`([^`]+)`/g;
  const matches = [...template.matchAll(shellPattern)];

  let result = template;
  for (const match of matches) {
    const [fullMatch, command] = match;
    try {
      const output = execSync(command!, {
        cwd: workingDir,
        encoding: 'utf-8',
        timeout: 30000,
        maxBuffer: 1024 * 1024, // 1MB buffer
      });
      result = result.replace(fullMatch, output.trim());
    } catch (error) {
      console.error(`Error executing shell command "${command}":`, error);
      result = result.replace(fullMatch, `[Error: Failed to execute "${command}"]`);
    }
  }

  return result;
}

/**
 * Replace file references with file content
 * Format: @filename or @path/to/file
 */
async function replaceFileReferences(template: string, workingDir: string): Promise<string> {
  const filePattern = /@([\w./-]+)/g;
  const matches = [...template.matchAll(filePattern)];

  let result = template;
  for (const match of matches) {
    const [fullMatch, filePath] = match;
    try {
      const fullPath = path.resolve(workingDir, filePath!);
      const content = await fs.readFile(fullPath, 'utf-8');
      result = result.replace(fullMatch, content);
    } catch (error) {
      console.error(`Error reading file "${filePath}":`, error);
      result = result.replace(fullMatch, `[Error: Could not read "${filePath}"]`);
    }
  }

  return result;
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
