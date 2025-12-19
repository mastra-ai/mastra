import { ToolLoopAgent } from '@internal/ai-v6';
import type { ToolLoopAgentSettings } from '@internal/ai-v6';

/**
 * Shape of a ToolLoopAgent-like object for runtime extraction.
 * We use this looser type because TypeScript's structural typing doesn't work
 * well with private properties across different package declarations.
 */
export interface ToolLoopAgentLike {
  readonly id?: string;
  readonly version?: string;
  // The settings property is private in ToolLoopAgent but accessible at runtime
  // We don't declare it here since we access it via type casting
}

export function isToolLoopAgentLike(obj: any): obj is ToolLoopAgentLike {
  if (!obj) return false;
  if (obj instanceof ToolLoopAgent) return true;
  return 'version' in obj && (obj.version === 'agent-v1' || obj.version.startsWith('agent-v'));
}

/**
 * Extracts the settings from a ToolLoopAgent instance.
 * ToolLoopAgent.settings is private in TypeScript but accessible at runtime.
 */
export function getSettings(agent: ToolLoopAgentLike): ToolLoopAgentSettings<any, any, any> {
  const settings = (agent as unknown as { settings: ToolLoopAgentSettings<any, any, any> }).settings;
  if (!settings) {
    throw new Error('Could not extract settings from ToolLoopAgent. The agent may be from an incompatible version.');
  }
  return settings;
}
