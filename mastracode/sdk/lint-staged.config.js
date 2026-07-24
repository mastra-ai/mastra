export default {
  '*.{ts,tsx}': files => {
    // scripts/ is ignored by eslint config; only oxfmt applies there.
    const linted = files.filter(f => !f.includes('/scripts/'));
    return [
      ...(linted.length ? [`eslint --fix --max-warnings=0 ${linted.join(' ')}`] : []),
      `oxfmt --no-error-on-unmatched-pattern ${files.join(' ')}`,
    ];
  },
  '*.{js,jsx}': ['oxfmt --no-error-on-unmatched-pattern'],
  '*.{json,md,yml,yaml}': ['oxfmt --no-error-on-unmatched-pattern'],
};
