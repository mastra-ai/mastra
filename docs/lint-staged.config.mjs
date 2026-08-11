export default {
  '*.{ts,tsx,js,jsx,json,md,yml,yaml,css}': ['oxfmt --no-error-on-unmatched-pattern'],
  'src/content/en/{docs,guides,reference}/**/*.mdx': ['oxfmt-mdx --write'],
}
