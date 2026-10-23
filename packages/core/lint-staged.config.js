export default {
  '*.{ts,tsx}': [
    'oxlint --type-aware --fix --deny-warnings --no-error-on-unmatched-pattern',
    'oxfmt --no-error-on-unmatched-pattern',
  ],
  '*.{js,jsx}': ['oxlint --type-aware --fix --no-error-on-unmatched-pattern', 'oxfmt --no-error-on-unmatched-pattern'],
  '*.{json,md,yml,yaml}': ['oxfmt --no-error-on-unmatched-pattern'],
};
