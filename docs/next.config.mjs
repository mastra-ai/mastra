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
      source: "/docs/agents/00-overview",
      destination: "/docs/agents/overview",
      permanent: true,
    },
    {
      source: "/docs/agents/01-agent-memory",
      destination: "/docs/agents/agent-memory",
      permanent: true,
    },
    {
      source: "/docs/agents/02-adding-tools",
      destination: "/docs/agents/adding-tools",
      permanent: true,
    },
    {
      source: "/docs/agents/02a-mcp-guide",
      destination: "/docs/agents/mcp-guide",
      permanent: true,
    },
    {
      source: "/docs/agents/03-adding-voice",
      destination: "/docs/agents/adding-voice",
      permanent: true,
    },
    {
      source: "/docs/evals/00-overview",
      destination: "/docs/evals/overview",
      permanent: true,
    },
    {
      source: "/docs/evals/01-textual-evals",
      destination: "/docs/evals/textual-evals",
      permanent: true,
    },
    {
      source: "/docs/evals/02-custom-eval",
      destination: "/docs/evals/custom-eval",
      permanent: true,
    },
    {
      source: "/docs/evals/03-running-in-ci",
      destination: "/docs/evals/running-in-ci",
      permanent: true,
    },

    {
      source: "/docs/guides/01-chef-michel",
      destination: "/docs/guides/chef-michel",
      permanent: true,
    },
    {
      source: "/docs/guides/02-stock-agent",
      destination: "/docs/guides/stock-agent",
      permanent: true,
    },
    {
      source: "/docs/guides/03-recruiter",
      destination: "/docs/guides/ai-recruiter",
      permanent: true,
    },
    {
      source: "/docs/guides/04-research-assistant",
      destination: "/docs/guides/research-assistant",
      permanent: true,
    },
    {
      source: "/docs/workflows/00-overview",
      destination: "/docs/workflows/overview",
      permanent: true,
    },
  ],
  trailingSlash: false,
});
