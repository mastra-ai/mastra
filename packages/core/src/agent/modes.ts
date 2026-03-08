import type { z } from 'zod';

import type { MastraModelConfig } from '../llm/model/shared.types';
import type { DynamicArgument } from '../types';

import type { AgentInstructions, ToolsInput } from './types';

/**
 * A mode is a named preset of instructions, model, and tools.
 * When an Agent has harness config with modes, callers can select
 * a mode per `.send()` operation.
 */
export interface AgentMode {
  /** Unique identifier for this mode (e.g., "plan", "build", "review") */
  id: string;

  /** Human-readable name for display */
  name?: string;

  /** Whether this is the default mode when no modeId is specified */
  default?: boolean;

  /** Instructions override for this mode */
  instructions?: DynamicArgument<AgentInstructions>;

  /** Model override for this mode */
  model?: DynamicArgument<MastraModelConfig>;

  /** Tools override for this mode (merged with agent-level tools) */
  tools?: DynamicArgument<ToolsInput>;
}

/**
 * Harness configuration for per-session orchestration capabilities.
 *
 * The `harness` config on an Agent defines what modes and state shape
 * are available. The actual mode selection and state values are per-operation
 * (passed to `.send()`), not stored on the Agent singleton.
 */
export interface AgentHarnessConfig {
  /**
   * Named presets of instructions, model, and tools.
   * Callers select a mode per `.send()` operation via `modeId`.
   */
  modes?: AgentMode[];

  /**
   * Zod object schema defining the shape of per-session state.
   * State values are passed to `.send()` per-operation and validated
   * against this schema. Tools can access state via `requestContext.get('agentState')`.
   */
  stateSchema?: z.ZodObject<z.ZodRawShape>;
}
