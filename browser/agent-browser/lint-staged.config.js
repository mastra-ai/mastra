export default {
  '*.{ts,tsx}': ['eslint --fix', 'oxfmt --no-error-on-unmatched-pattern'],
  '*.{js,jsx}': ['oxfmt --no-error-on-unmatched-pattern'],
  '*.{json,md,yml,yaml}': ['oxfmt --no-error-on-unmatched-pattern'],
};
