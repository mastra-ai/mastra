export default {
  '*.{ts,tsx}': ['oxlint --type-aware --fix', 'oxfmt --no-error-on-unmatched-pattern'],
  '*.{js,jsx}': ['oxfmt --no-error-on-unmatched-pattern'],
  '*.{json,md,yml,yaml}': ['oxfmt --no-error-on-unmatched-pattern'],
};
