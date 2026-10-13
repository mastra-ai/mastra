export default {
  '**/*.{ts,tsx}': () => ['oxlint --fix', 'eslint --fix'],
};
