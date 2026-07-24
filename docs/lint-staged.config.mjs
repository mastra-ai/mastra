export default {
  '*.{ts,tsx,js,jsx,json,md,yml,yaml,css}': ['oxfmt --no-error-on-unmatched-pattern'],
  '*.mdx': ['prettier --write'],
}
