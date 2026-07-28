export default {
  '*.{ts,tsx,js,jsx,json,md,yml,yaml,css}': ['oxfmt --no-error-on-unmatched-pattern'],
  '*.mdx': ['oxfmt-mdx --write src/content/en/docs src/content/en/guides src/content/en/reference'],
}
