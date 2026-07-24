export default {
  '**/*.{ts,tsx}': ['eslint --fix --max-warnings=0', 'oxfmt --no-error-on-unmatched-pattern'],
  '**/*.{js,jsx}': ['eslint --fix', 'oxfmt --no-error-on-unmatched-pattern'],
  '**/*.{json,md,yml,yaml}': ['oxfmt --no-error-on-unmatched-pattern'],
};
