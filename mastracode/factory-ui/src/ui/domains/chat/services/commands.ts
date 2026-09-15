import type { ComposerCommand } from '@mastra/playground-ui/components/Composer';
export { matchCommands, matchCommandOptions } from '@mastra/playground-ui/components/Composer';
export type { ComposerCommandOption as SlashCommandOption } from '@mastra/playground-ui/components/Composer';

export interface SlashCommandDescriptor extends Pick<ComposerCommand, 'name' | 'description'> {
  args?: string;
  requiresSession: boolean;
}

export interface SlashCommand extends SlashCommandDescriptor {
  options?: ComposerCommand['options'];
  execute: (rawArguments: string, originalText: string) => Promise<void>;
}

export interface ParsedSlashCommand {
  name?: string;
  rawArguments: string;
}

export function parseSlashCommand(text: string): ParsedSlashCommand {
  if (!text.startsWith('/')) return { rawArguments: '' };
  const withoutSlash = text.slice(1);
  const firstWhitespace = withoutSlash.search(/\s/);
  if (firstWhitespace === -1) return { name: withoutSlash, rawArguments: '' };
  return {
    name: withoutSlash.slice(0, firstWhitespace),
    rawArguments: withoutSlash.slice(firstWhitespace).trim(),
  };
}

export function commandRequiresReadySession(commands: readonly SlashCommandDescriptor[], text: string): boolean {
  const { name } = parseSlashCommand(text);
  return commands.find(command => command.name === name)?.requiresSession ?? false;
}

export function findCommand<T extends SlashCommandDescriptor>(commands: readonly T[], text: string): T | undefined {
  const { name } = parseSlashCommand(text);
  return commands.find(command => command.name === name);
}
