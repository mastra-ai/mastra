export default {
  '*.{ts,tsx}': [
    'oxlint --fix --deny-warnings --no-error-on-unmatched-pattern',
    'eslint --fix --max-warnings=0 --no-warn-ignored',
    'oxfmt --no-error-on-unmatched-pattern',
  ],
  '*.{js,jsx}': ['oxlint --fix', 'eslint --fix', 'oxfmt --no-error-on-unmatched-pattern'],
  '*.{json,md,yml,yaml}': ['oxfmt --no-error-on-unmatched-pattern'],
};
