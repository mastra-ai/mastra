import { createHash } from 'node:crypto';
import type { DiscordCommand, DiscordCommandInput } from './types';

/**
 * Conventional command seed registered when a connect provides none. Discord
 * surfaces `/help` in the command picker; the built-in DM/mention handling
 * covers everything else, so the seed is intentionally tiny.
 * @see https://discord.com/developers/docs/interactions/application-commands
 */
export const DEFAULT_COMMANDS: readonly DiscordCommandInput[] = [
  { name: 'help', description: 'Show what this bot can do' },
];

/**
 * Map user-supplied commands to Discord `CHAT_INPUT` command shapes, enforcing
 * the API constraints: `name` is lowercased, stripped of a leading slash,
 * reduced to `[a-z0-9_-]`, and clamped to 1-32 chars; `description` defaults to
 * `Run /<name>` and is clamped to 1-100 chars. Empty or duplicate names are
 * dropped.
 *
 * @see https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-naming
 */
export function normalizeCommands(raw: readonly DiscordCommandInput[] | undefined): DiscordCommand[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const commands: DiscordCommand[] = [];
  for (const item of raw) {
    const input = typeof item === 'string' ? { name: item } : item;
    const name = input.name
      .replace(/^\//, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 32);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const description = (input.description?.trim() || `Run /${name}`).slice(0, 100);
    commands.push({ name, description });
  }
  return commands;
}

/**
 * Stable content hash of a normalized command list, used to skip re-`PUT`ting a
 * guild/global command set that hasn't changed (Discord allows only 200
 * application-command creates per day, per guild). Order-independent: commands
 * are sorted by name before hashing.
 */
export function hashCommands(commands: readonly DiscordCommand[]): string {
  const canonical = [...commands]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => ({ name: c.name, description: c.description }));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex').slice(0, 16);
}
