export default {
  // Generated route metadata is ignored by oxlint; without this flag a commit that only
  // touches those files fails the hook with "No files found to lint".
  '*.{ts,tsx}': [
    'oxlint --type-aware --fix --deny-warnings --no-error-on-unmatched-pattern',
    'oxfmt --no-error-on-unmatched-pattern',
  ],
  '*.{js,jsx}': ['oxlint --type-aware --fix --no-error-on-unmatched-pattern', 'oxfmt --no-error-on-unmatched-pattern'],
  '*.{json,md,yml,yaml}': ['oxfmt --no-error-on-unmatched-pattern'],
};
