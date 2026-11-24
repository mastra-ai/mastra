export interface ComposerCommandOption {
  value: string;
  label: string;
  description?: string;
  active?: boolean;
}

export interface ComposerCommand {
  name: string;
  description: string;
  options?: readonly ComposerCommandOption[];
}

export function matchCommands<T extends Pick<ComposerCommand, 'name'>>(commands: readonly T[], draft: string): T[] {
  if (!draft.startsWith('/')) return [];
  const query = draft.slice(1).toLowerCase();
  if (/\s/.test(query)) return [];
  return commands.filter(command => command.name.toLowerCase().startsWith(query));
}

export function matchCommandOptions<T extends ComposerCommand>(commands: readonly T[], draft: string) {
  if (!draft.startsWith('/')) return undefined;
  const firstWhitespace = draft.search(/\s/);
  if (firstWhitespace === -1) return undefined;
  const command = commands.find(candidate => candidate.name === draft.slice(1, firstWhitespace));
  if (!command?.options) return undefined;
  const query = draft.slice(firstWhitespace).trim().toLowerCase();
  if (/\s/.test(query)) return undefined;
  const options = command.options.filter(option => option.value.toLowerCase().startsWith(query));
  return options.length > 0 ? { command, options } : undefined;
}
