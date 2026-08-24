/**
 * Pure slash-command input handling: parsing, matching, and the executable
 * command shape shared by built-ins and runtime (server-discovered) commands.
 * No React, no I/O — unit tests cover this file directly.
 */

export interface ChatCommandDescriptor {
  /** Exact composer token, slashes included (`/goal`, `//deploy`, `/skill/x`). */
  invocation: string;
  /** Placeholder shown after the invocation (e.g. `<objective>`). */
  argumentHint?: string;
  description: string;
}

export type CommandAvailability = { state: 'available' } | { state: 'unavailable'; reason: string };

export interface ResolvedChatCommand extends ChatCommandDescriptor {
  id: string;
  availability: CommandAvailability;
  /** Static completions offered while typing arguments (e.g. mode ids). */
  completeArguments?: string[];
  /** When true, submitting without arguments reports usage instead of running. */
  requiresArguments?: boolean;
  /** `rawArguments` is the post-token text; `originalText` is the whole input. */
  execute(rawArguments: string, originalText: string): Promise<void>;
}

export interface ParsedCommandInput {
  /** First whitespace-delimited token including its slashes, when present. */
  command?: string;
  /** Everything after that token, verbatim (interior spacing preserved). */
  rawArguments: string;
  /** True once any whitespace follows the command — the args phase. */
  hasArguments: boolean;
}

/**
 * Split a composer draft into a command token and the raw argument string.
 * `//` is parsed before `/` so explicit custom commands keep both slashes,
 * and exact runtime tokens containing `/` or `:` stay intact. A single
 * trailing space (`/goal `) already counts as the args phase.
 */
export function parseCommandInput(text: string): ParsedCommandInput {
  const started = text.trimStart();
  if (!started.startsWith('/')) return { rawArguments: '', hasArguments: false };
  const firstWhitespace = started.search(/\s/);
  if (firstWhitespace === -1) return { command: started, rawArguments: '', hasArguments: false };
  return {
    command: started.slice(0, firstWhitespace),
    rawArguments: started.slice(firstWhitespace).trim(),
    hasArguments: true,
  };
}

/**
 * Commands matching the current draft. Returns everything while the user has
 * only typed `/`, narrows by prefix as they type, and stops at the args phase.
 */
export function matchCommands<T extends ChatCommandDescriptor>(commands: readonly T[], draft: string): T[] {
  const { command, hasArguments } = parseCommandInput(draft);
  if (!command || hasArguments) return [];
  const query = command.toLowerCase();
  return commands.filter(candidate => candidate.invocation.toLowerCase().startsWith(query));
}

/** Exact-invocation lookup for execution; suggestions insert `invocation` verbatim. */
export function findCommand<T extends ChatCommandDescriptor>(commands: readonly T[], text: string): T | undefined {
  const { command } = parseCommandInput(text);
  if (!command) return undefined;
  return commands.find(candidate => candidate.invocation === command);
}
