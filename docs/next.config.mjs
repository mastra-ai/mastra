/** @type {import('next').NextConfig} */
import nextra from 'nextra';

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.jsx',
});

export default withNextra({
  basePath: '/docs',
  trailingSlash: false,
});
