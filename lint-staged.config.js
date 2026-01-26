export default {
  // Type safety - currently a no-op due to tsc-files bug with TS 5.9.3
  // TODO: revisit when tsc-files is fixed
  '**/*.ts?(x)': 'pnpm exec tsc-files --noEmit',

  // Code quality and style
  '*.{ts,tsx}': ['pnpm exec eslint --fix --max-warnings=0', 'pnpm exec prettier --write'],

  // Non-TS JavaScript
  '*.{js,jsx}': ['pnpm exec eslint --fix', 'pnpm exec prettier --write'],

  // Documentation and config
  '*.{json,md,yml,yaml}': ['pnpm exec prettier --write'],
};
