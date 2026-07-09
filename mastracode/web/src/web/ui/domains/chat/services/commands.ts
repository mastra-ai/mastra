/**
 * Slash-command registry. A single source of truth for the composer's
 * autocomplete menu and the `/help` listing, so they never drift apart.
 */
import type { PermissionPolicy, PermissionRules, ToolCategory } from '@mastra/client-js';

import type { TranscriptState } from './transcript';

export interface SlashCommand {
  /** Command name without the leading slash (e.g. "mode"). */
  name: string;
  /** Argument hint shown after the name (e.g. "<id>"). */
  args?: string;
  /** One-line description. */
  description: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'model', args: '<id>', description: 'Switch model' },
  { name: 'goal', args: '<objective>', description: 'Set a goal' },
  { name: 'goal-clear', description: 'Clear the active goal' },
  { name: 'goal-pause', description: 'Pause the active goal' },
  { name: 'goal-resume', description: 'Resume the paused goal' },
  { name: 'permissions', description: 'Show permission rules' },
  { name: 'yolo', description: 'Auto-allow all tool categories' },
  { name: 'cost', description: 'Show token usage' },
  { name: 'think', description: 'Hint on extended thinking' },
  { name: 'om', description: 'Show observational-memory phase' },
  { name: 'settings', description: 'Show session state' },
  { name: 'follow-up', args: '<message>', description: 'Queue a follow-up message' },
  { name: 'abort', description: 'Abort the current run' },
  { name: 'help', description: 'Show the command list' },
];

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

/**
 * The narrow slice of session/transcript/project state the no-arg command
 * dispatcher needs. Kept structural so it is trivially stubbed in unit tests
 * and satisfied by the real `useChatSession()` / `useActiveProjectContext()`
 * values.
 */
export interface NoArgCommandDeps {
  session: {
    clearGoal: () => Promise<void>;
    pauseGoal: () => Promise<void>;
    resumeGoal: () => Promise<void>;
    abort: () => Promise<void>;
    getPermissions: () => Promise<PermissionRules>;
    setPermissionForCategory: (category: ToolCategory, policy: PermissionPolicy) => Promise<void>;
    pushNotice: (text: string, level?: 'info' | 'error') => void;
  };
  transcript: Pick<TranscriptState, 'usage' | 'omPhase' | 'threadId' | 'running'>;
  activeProject: { name: string; path?: string } | null;
  activeModeId?: string;
  activeModelId?: string;
}

/**
 * Executes a slash command that takes no arguments (palette activation or a
 * bare `/name` in the composer). Commands that need arguments fall through to
 * an error notice directing the user to the composer.
 */
export async function runNoArgCommand(
  name: string,
  { session, transcript, activeProject, activeModeId, activeModelId }: NoArgCommandDeps,
) {
  switch (name) {
    case 'goal-clear':
      await session.clearGoal();
      return;
    case 'goal-pause':
      await session.pauseGoal();
      return;
    case 'goal-resume':
      await session.resumeGoal();
      return;
    case 'permissions': {
      const rules = await session.getPermissions();
      const cats =
        Object.entries(rules.categories ?? {})
          .map(([k, v]) => `  ${k}: ${v}`)
          .join('\n') || '  (none)';
      const tools =
        Object.entries(rules.tools ?? {})
          .map(([k, v]) => `  ${k}: ${v}`)
          .join('\n') || '  (none)';
      session.pushNotice(`Categories:\n${cats}\nTools:\n${tools}`);
      return;
    }
    case 'yolo':
      for (const cat of ['read', 'edit', 'execute', 'mcp', 'other'] as const) {
        await session.setPermissionForCategory(cat, 'allow');
      }
      session.pushNotice('YOLO mode: all tool categories set to auto-allow');
      return;
    case 'cost': {
      const u = transcript.usage;
      session.pushNotice(
        !u?.totalTokens
          ? 'No token usage recorded yet.'
          : `Tokens — prompt: ${u.promptTokens ?? 0}, completion: ${u.completionTokens ?? 0}, total: ${u.totalTokens}`,
      );
      return;
    }
    case 'think':
      session.pushNotice(
        'Extended thinking: steer the agent with "think step by step" or switch to a thinking-capable model.',
      );
      return;
    case 'om':
      session.pushNotice(`Observational memory phase: ${transcript.omPhase ?? 'idle'}`);
      return;
    case 'settings':
      session.pushNotice(
        [
          `Project: ${activeProject?.name ?? '(none)'}`,
          `Path: ${activeProject?.path ?? '(default workspace)'}`,
          `Mode: ${activeModeId ?? '—'}`,
          `Model: ${activeModelId ?? '—'}`,
          `Thread: ${transcript.threadId ?? '—'}`,
          `Running: ${transcript.running}`,
        ].join('\n'),
      );
      return;
    case 'abort':
      await session.abort();
      return;
    case 'help': {
      const width = Math.max(...SLASH_COMMANDS.map(c => `/${c.name} ${c.args ?? ''}`.length));
      const lines = SLASH_COMMANDS.map(c => {
        const sig = `/${c.name} ${c.args ?? ''}`.padEnd(width);
        return `  ${sig}  — ${c.description}`;
      });
      session.pushNotice(['Available commands:', ...lines].join('\n'));
      return;
    }
    default:
      session.pushNotice(`Command /${name} needs arguments. Type it in the composer.`, 'error');
  }
}
