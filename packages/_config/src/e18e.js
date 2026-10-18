import { fileURLToPath } from 'node:url';

const e18ePlugin = {
  name: 'e18e',
  specifier: fileURLToPath(import.meta.resolve('@e18e/eslint-plugin')),
};

/** @satisfies {import('oxlint').OxlintConfig['rules']} */
const e18eRules = {
  'e18e/prefer-array-from-map': 'error',
  'e18e/prefer-timer-args': 'error',
  'e18e/prefer-date-now': 'error',
  'e18e/prefer-regex-test': 'error',
  'e18e/prefer-array-some': 'error',
  'e18e/prefer-static-regex': 'error',
  'e18e/prefer-string-fromcharcode': 'error',
  'e18e/ban-dependencies': 'error',
};

export { e18ePlugin, e18eRules };
