export interface SlashCommandDescriptor {
  name: string;
  args?: string;
  description: string;
  requiresSession: boolean;
}

export interface SlashCommand extends SlashCommandDescriptor {
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

export function matchCommands<T extends SlashCommandDescriptor>(commands: readonly T[], draft: string): T[] {
  if (!draft.startsWith('/')) return [];
  const rest = draft.slice(1);
  if (/\s/.test(rest)) return [];
  const query = rest.toLowerCase();
  return commands.filter(command => command.name.toLowerCase().startsWith(query));
}
