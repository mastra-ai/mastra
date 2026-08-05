export default {
  '*.{ts,tsx,js,jsx,json,md,yml,yaml,css}': ['oxfmt --no-error-on-unmatched-pattern'],
  '*.mdx': filenames =>
    filenames
      .filter(filename => !filename.includes('/src/content/en/models/'))
      .map(filename => `oxfmt-mdx --write "${filename}"`),
}
