import { defineConfig } from 'oxlint';
import rootConfig from '../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@mastra/core', '@mastra/core/*'],
            message:
              'Voice packages must import shared voice/core primitives from @internal/voice or @internal/core, not @mastra/core.',
          },
        ],
      },
    ],
  },
});
