import { createConfig } from '@internal/lint/eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import testingLibrary from 'eslint-plugin-testing-library';

const sharedConfig = await createConfig();
const reactRecommended = reactHooks.configs.flat['recommended-latest'];
const strictReactRules = Object.fromEntries(
  Object.entries(reactRecommended.rules).map(([ruleName, setting]) => [
    ruleName,
    Array.isArray(setting) ? ['error', ...setting.slice(1)] : 'error',
  ]),
);

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...sharedConfig,
  {
    ...reactRecommended,
    files: ['src/**/*.{ts,tsx}'],
    rules: strictReactRules,
  },
  {
    files: ['src/**/__tests__/**/*.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    plugins: { 'testing-library': testingLibrary },
    rules: {
      'testing-library/no-unnecessary-act': ['error', { isStrict: false }],
      'testing-library/no-wait-for-side-effects': 'error',
      'testing-library/prefer-find-by': 'error',
    },
  },
  {
    files: [
      'src/mount.tsx',
      'src/host.ts',
      'src/host-context.tsx',
      'src/shared/api/types.ts',
      'src/shared/api/errors.ts',
      'src/shared/desktop-host.ts',
      'src/ui/domains/chat/components/ErrorNotice.tsx',
      'src/ui/domains/settings/components/ProviderRow.tsx',
      'src/ui/ui/AppBootScreen.tsx',
    ],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },
];
