export default {
  '*.{ts,tsx}': files => {
    // scripts/ is ignored by the oxlint config; only oxfmt applies there.
    const linted = files.filter(f => !f.includes('/scripts/'));
    return [
      ...(linted.length ? [`oxlint --type-aware --fix --deny-warnings ${linted.join(' ')}`] : []),
      `oxfmt --no-error-on-unmatched-pattern ${files.join(' ')}`,
    ];
  },
  '*.{js,jsx}': ['oxfmt --no-error-on-unmatched-pattern'],
  '*.{json,md,yml,yaml}': ['oxfmt --no-error-on-unmatched-pattern'],
};
