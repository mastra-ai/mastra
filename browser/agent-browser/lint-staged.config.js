export default {
  '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{js,jsx}': ['prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
