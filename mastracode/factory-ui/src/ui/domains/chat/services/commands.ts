/**
 * Slash-command registry. A single source of truth for the composer's
 * autocomplete menu and the `/help` listing, so they never drift apart.
 */
export interface SlashCommand {
  /** Command name without the leading slash (e.g. "mode"). */
  name: string;
  /** Argument hint shown after the name (e.g. "<id>"). */
  args?: string;
  /** One-line description. */
  description: string;
  requiresSession: boolean;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'model', args: '<id>', description: 'Switch model', requiresSession: true },
  { name: 'goal', args: '<objective>', description: 'Set a goal', requiresSession: true },
  { name: 'goal-clear', description: 'Clear the active goal', requiresSession: true },
  { name: 'goal-pause', description: 'Pause the active goal', requiresSession: true },
  { name: 'goal-resume', description: 'Resume the paused goal', requiresSession: true },
  { name: 'permissions', description: 'Show permission rules', requiresSession: true },
  { name: 'yolo', description: 'Auto-allow all tool categories', requiresSession: true },
  { name: 'cost', description: 'Show token usage', requiresSession: false },
  { name: 'think', description: 'Hint on extended thinking', requiresSession: false },
  { name: 'om', description: 'Show observational-memory phase', requiresSession: false },
  { name: 'settings', description: 'Show session state', requiresSession: false },
  { name: 'follow-up', args: '<message>', description: 'Queue a follow-up message', requiresSession: true },
  { name: 'abort', description: 'Abort the current run', requiresSession: true },
  { name: 'help', description: 'Show the command list', requiresSession: false },
];

export function commandRequiresReadySession(text: string): boolean {
  const [name] = text.slice(1).split(/\s+/, 1);
  return SLASH_COMMANDS.find(command => command.name === name)?.requiresSession ?? true;
}

/**
 * Commands matching the current draft. Returns the full list while the user has
 * only typed "/", then narrows by prefix as they type the command name. Returns
 * an empty array once a complete command + space has been typed (args phase).
 */
export function matchCommands(draft: string): SlashCommand[] {
  if (!draft.startsWith('/')) return [];
  const rest = draft.slice(1);
  // Once there's whitespace, the user is typing args — stop suggesting.
  if (/\s/.test(rest)) return [];
  const query = rest.toLowerCase();
  return SLASH_COMMANDS.filter(c => c.name.toLowerCase().startsWith(query));
}
