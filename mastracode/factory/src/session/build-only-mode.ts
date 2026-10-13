import type { ThinkingResolutionOptions } from '@mastra/code-sdk/agents/model';
import { buildMode } from '@mastra/code-sdk/agents/modes/build';
import type { AgentControllerMode } from '@mastra/core/agent-controller';

import { FACTORY_FALLBACK_THINKING_LEVEL } from './model-selection.js';

/** Factory sessions only run Build: threads saved in Plan or Fast fall back to it on restore. */
export const FACTORY_MODES: AgentControllerMode[] = [buildMode];

/** The shared settings file belongs to the terminal app, so it never picks a Factory thinking level. */
export const FACTORY_THINKING_RESOLUTION = {
  defaultLevel: FACTORY_FALLBACK_THINKING_LEVEL,
} satisfies ThinkingResolutionOptions;
