export default {
  '*.{ts,tsx}': ['oxlint --type-aware --fix --deny-warnings', 'prettier --write'],
  '*.{js,jsx}': ['oxlint --type-aware --fix', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
