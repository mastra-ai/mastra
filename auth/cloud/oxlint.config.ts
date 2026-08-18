import { defineConfig } from 'oxlint';
import rootConfig from '../../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@mastra/core', '@mastra/core/*'],
            message: 'Auth packages must not import from @mastra/core. Use @internal/auth instead.',
          },
        ],
      },
    ],
  },
});
