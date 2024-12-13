/** @type {import('next').NextConfig} */
import nextra from 'nextra';

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
  mdxOptions: {
    rehypePrettyCodeOptions: {
      theme: {
        dark: 'vesper',
        light: 'vitesse-light',
      },
    },
  },
});

export default withNextra({
  basePath: '/docs',
  trailingSlash: false,
});
