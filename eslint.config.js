import tseslint from 'typescript-eslint';

// Root eslint config for lint-staged
// Individual packages have their own eslint configs with full rules
// This minimal config prevents lint-staged failures while allowing package-level linting
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/build/**', '**/.turbo/**', '**/coverage/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {},
  },
);
