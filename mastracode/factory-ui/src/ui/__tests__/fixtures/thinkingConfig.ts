import { THINKING_LEVEL_VALUES } from '@mastra/code-sdk/thinking';

import type { ThinkingConfigInfo } from '../../../api/types';

export const thinkingConfig: ThinkingConfigInfo = {
  levels: THINKING_LEVEL_VALUES,
  globalDefault: 'medium',
  modeDefaults: {},
  modes: ['build', 'plan'],
  editable: true,
};
