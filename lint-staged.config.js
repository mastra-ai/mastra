export default {
  // Type safety - currently a no-op due to tsc-files bug with TS 5.9.3
  // TODO: revisit when tsc-files is fixed
  '**/*.ts?(x)': 'pnpm exec tsc-files --noEmit',

  // Code quality and style
  // TODO: eslint temporarily disabled - config was removed in f9764aaf1e but lint-staged still referenced it
  '*.{ts,tsx}': ['pnpm exec prettier --write'],

  // Non-TS JavaScript
  '*.{js,jsx}': ['pnpm exec prettier --write'],

  // Documentation and config
  '*.{json,md,yml,yaml}': ['pnpm exec prettier --write'],
};
