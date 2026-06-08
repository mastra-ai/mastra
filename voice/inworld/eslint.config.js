import { createConfig } from '@internal/lint/eslint';

const config = await createConfig();

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
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
  },
];
