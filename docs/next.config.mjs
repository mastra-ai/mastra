/** @type {import('next').NextConfig} */
import nextra from 'nextra';

const withNextra = nextra({
  search: {
    codeblocks: true
  },
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
  assetPrefix: process.env.NODE_ENV === "production" ? "/docs" : "",

  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/docs/_next/:path+",
          destination: "/_next/:path+",
        },
      ],
    };
  },
  redirects: () => [
    {
      source: "/docs/08-running-evals",
      destination: "/docs/evals/overview",
      permanent: true,
    },
    {
      source: "/docs/guides/04-recruiter",
      destination: "/docs/guides/ai-recruiter",
      permanent: true,
    },
    {
      source: "/docs/:path*/:prefix(\\d{2}[a-z]?)-:slug",
      destination: "/docs/:path*/:slug",
      permanent: true,
    },
  ],
  trailingSlash: false,
});
