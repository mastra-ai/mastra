import type { ThinkingResolutionOptions } from '@mastra/code-sdk/agents/model';
import { buildMode } from '@mastra/code-sdk/agents/modes/build';
import type { AgentControllerMode } from '@mastra/core/agent-controller';

/** Factory sessions only run Build: threads saved in Plan or Fast fall back to it on restore. */
export const FACTORY_MODES: AgentControllerMode[] = [buildMode];

/** Without modes, per-mode thinking defaults from the shared settings file must not pick the level. */
export const FACTORY_THINKING_RESOLUTION = { applyModeDefaults: false } satisfies ThinkingResolutionOptions;
