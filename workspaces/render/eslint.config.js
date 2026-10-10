import { createConfig } from '@internal/lint/eslint';

const config = await createConfig();

export default [
  { ignores: ['validation/**'] },
  ...config,
  { files: ['scripts/**/*.{ts,mjs}', 'examples/**/*.{ts,mjs}'], rules: { 'no-console': 'off' } },
];
