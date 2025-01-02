/** @type {import('next').NextConfig} */
import nextra from 'nextra';

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
  mdxOptions: {
    rehypePrettyCodeOptions: {
      theme: {
        dark: 'github-dark',
        light: 'github-light',
      },
    },
  },
});

export default withNextra({
  assetPrefix: '/docs-static',
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/docs-static/_next/:path+',
          destination: '/_next/:path+',
        },
      ],
    };
  },
  trailingSlash: false,
});
