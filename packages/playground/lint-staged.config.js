export default {
  '*.{ts,tsx}': ['eslint --fix --max-warnings=0 --rule "react-hooks/exhaustive-deps: off"', 'prettier --write'],
  '*.{js,jsx}': ['eslint --fix --rule "react-hooks/exhaustive-deps: off"', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
