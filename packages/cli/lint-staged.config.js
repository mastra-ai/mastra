export default {
  // Generated route metadata is ignored by oxlint; without this flag a commit that only
  // touches those files fails the hook with "No files found to lint".
  '*.{ts,tsx}': [
    'oxlint --fix --deny-warnings --no-error-on-unmatched-pattern',
    'eslint --fix --max-warnings=0 --no-warn-ignored',
    'oxfmt --no-error-on-unmatched-pattern',
  ],
  '*.{js,jsx}': [
    'oxlint --fix --no-error-on-unmatched-pattern',
    'eslint --fix',
    'oxfmt --no-error-on-unmatched-pattern',
  ],
  '*.{json,md,yml,yaml}': ['oxfmt --no-error-on-unmatched-pattern'],
};
