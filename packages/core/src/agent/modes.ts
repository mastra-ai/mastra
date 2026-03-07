import type { MastraModelConfig } from '../llm/model/shared.types';
import type { DynamicArgument } from '../types';

import type { AgentInstructions, ToolsInput } from './types';

/**
 * A mode is a named preset of instructions, model, and tools.
 * When an Agent has modes configured, you can switch between them
 * at runtime without creating a new Agent.
 */
export interface AgentMode {
  /** Unique identifier for this mode (e.g., "plan", "build", "review") */
  id: string;

  /** Human-readable name for display */
  name?: string;

  /** Whether this is the default mode when the agent starts */
  default?: boolean;

  /** Instructions override for this mode */
  instructions?: DynamicArgument<AgentInstructions>;

  /** Model override for this mode */
  model?: DynamicArgument<MastraModelConfig>;

  /** Tools override for this mode (merged with agent-level tools) */
  tools?: DynamicArgument<ToolsInput>;
}
