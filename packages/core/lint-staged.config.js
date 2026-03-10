export default {
  '*.{ts,tsx}': ['eslint --fix --max-warnings=0 --no-warn-ignored', 'prettier --write'],
  '*.{js,jsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
