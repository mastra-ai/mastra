/** @type {import('next').NextConfig} */
import nextra from 'nextra';

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.jsx',
});

export default withNextra({
  async redirects() {
    return [
      {
        source: '/',
        destination: '/docs',
        permanent: true,
      },
    ];
  },
  basePath: '/docs',
  trailingSlash: false,
});
