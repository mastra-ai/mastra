import type { BotCommand, TelegramCommand } from './types';

/**
 * Conventional command seed registered when a connect provides none.
 * @see https://core.telegram.org/bots/features#commands
 */
export const DEFAULT_COMMANDS: readonly TelegramCommand[] = [
  { command: 'start', description: 'Start a conversation' },
  { command: 'help', description: 'Show what this bot can do' },
  { command: 'settings', description: 'Manage your preferences' },
];

/**
 * Map user-supplied commands (agent capabilities) to Telegram `BotCommand[]`,
 * enforcing the Bot API constraints: `command` is lowercased, stripped of a
 * leading slash, reduced to `[a-z0-9_]`, and clamped to 1-32 chars;
 * `description` defaults to `Run /<command>` and is clamped to 256 chars.
 * Empty or duplicate command names are dropped.
 */
export function normalizeCommands(raw: readonly TelegramCommand[] | undefined): BotCommand[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const commands: BotCommand[] = [];
  for (const item of raw) {
    const input = typeof item === 'string' ? { command: item } : item;
    const command = input.command
      .replace(/^\//, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 32);
    if (!command || seen.has(command)) continue;
    seen.add(command);
    const description = (input.description?.trim() || `Run /${command}`).slice(0, 256);
    commands.push({ command, description });
  }
  return commands;
}
