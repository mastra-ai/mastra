export default {
  '*.{ts,tsx}': [
    'oxlint --fix --deny-warnings',
    'eslint --fix --max-warnings=0',
    'oxfmt --no-error-on-unmatched-pattern',
  ],
  '*.{js,jsx}': ['oxfmt --no-error-on-unmatched-pattern'],
  '*.{json,md,yml,yaml}': ['oxfmt --no-error-on-unmatched-pattern'],
};
