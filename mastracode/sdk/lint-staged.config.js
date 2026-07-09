export default {
  '*.{ts,tsx}': files => {
    // scripts/ is ignored by eslint config; only prettier applies there.
    const linted = files.filter(f => !f.includes('/scripts/'));
    return [
      ...(linted.length ? [`eslint --fix --max-warnings=0 ${linted.join(' ')}`] : []),
      `prettier --write ${files.join(' ')}`,
    ];
  },
  '*.{js,jsx}': ['prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
