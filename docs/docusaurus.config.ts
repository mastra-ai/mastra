import 'dotenv/config'
import prismMastraDark from './src/theme/prism-mastra-dark.js'
import prismMastraLight from './src/theme/prism-mastra-light.js'
import remarkModelTokens from './src/plugins/remark-model-tokens'
import type { Config } from '@docusaurus/types'
import type { ThemeConfig } from '@docusaurus/preset-classic'
import type { AlgoliaPluginOptions } from '@mastra/docusaurus-plugin-algolia'

const NPM2YARN_CONFIG = { sync: true, converters: ['pnpm', 'yarn', 'bun'] }
const SHARED_REMARK_PLUGINS = [
  remarkModelTokens,
  [require('@docusaurus/remark-plugin-npm2yarn'), NPM2YARN_CONFIG],
] as const
const ADMONITIONS_CONFIG = {
  keywords: ['note', 'tip', 'info', 'warning', 'danger', 'experimental'],
}

// The Kapa "Ask AI" chat requires an integrationId at build time. Only
// register the theme when both credentials are available — e.g. locally and
// in production — so CI and preview builds without the secrets still succeed.
// When the theme is absent, the doc layout falls back to the classic theme and
// `KapaChatProvider` in Root.tsx renders its children unchanged.
const KAPA_INTEGRATION_ID = process.env.KAPA_INTEGRATION_ID
const KAPA_GROUP_ID = process.env.KAPA_GROUP_ID
const kapaThemes: Config['themes'] =
  KAPA_INTEGRATION_ID && KAPA_GROUP_ID
    ? [
        [
          '@mastra/docusaurus-plugin-kapa',
          {
            integrationId: KAPA_INTEGRATION_ID,
            groupId: KAPA_GROUP_ID,
          },
        ],
      ]
    : []

const config: Config = {
  title: 'Mastra Docs',
  tagline: 'The TypeScript Agent Framework',
  favicon: '/img/favicon.ico',
  url: 'https://mastra.ai',
  baseUrl: '/',
  // hint: do NOT set trailingSlash to any value to avoid rendering issues on vercel
  // see: https://github.com/slorber/trailing-slash-guide
  // trailingSlash: false,
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },
  future: {
    v4: {
      // TODO: Turn this to true and fix everything
      useCssCascadeLayers: false,
      removeLegacyPostBuildHeadAttribute: true,
    },
    faster: true,
  },
  // Custom fields for HubSpot and Analytics
  customFields: {
    hsPortalId: process.env.HS_PORTAL_ID,
    hsFormGuid: process.env.HS_FORM_GUID,
    hsFormGuidLearn: process.env.HS_FORM_GUID_LEARN,
    mastraWebsite: process.env.MASTRA_WEBSITE,
    // Analytics
    gaId: process.env.GA_ID,
    posthogApiKey: process.env.POSTHOG_API_KEY,
    posthogHost: process.env.POSTHOG_HOST,
  },
  plugins: [
    [require.resolve('./src/plugins/tailwind/tailwind-plugin'), {}],
    [require.resolve('./src/plugins/docusaurus-plugin-learn'), {}],
    [
      '@docusaurus/plugin-vercel-analytics',
      {
        debug: false,
        mode: 'auto',
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'models',
        path: 'src/content/en/models',
        routeBasePath: 'models',
        sidebarPath: './src/content/en/models/sidebars.js',
        editUrl: 'https://github.com/mastra-ai/mastra/tree/main/docs',
        admonitions: ADMONITIONS_CONFIG,
        remarkPlugins: [...SHARED_REMARK_PLUGINS],
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'guides',
        path: 'src/content/en/guides',
        routeBasePath: 'guides',
        sidebarPath: './src/content/en/guides/sidebars.js',
        editUrl: 'https://github.com/mastra-ai/mastra/tree/main/docs',
        admonitions: ADMONITIONS_CONFIG,
        remarkPlugins: [...SHARED_REMARK_PLUGINS],
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'reference',
        path: 'src/content/en/reference',
        routeBasePath: 'reference',
        sidebarPath: './src/content/en/reference/sidebars.js',
        editUrl: 'https://github.com/mastra-ai/mastra/tree/main/docs',
        admonitions: ADMONITIONS_CONFIG,
        remarkPlugins: [...SHARED_REMARK_PLUGINS],
      },
    ],
    [
      require.resolve('./src/plugins/docusaurus-plugin-llms-txt'),
      {
        siteUrl: 'https://mastra.ai',
        siteTitle: 'Mastra',
        excludeRoutes: ['/404'],
      },
    ],
    [
      '@mastra/docusaurus-plugin-algolia',
      {
        indexName: 'docs_main',
        hitsPerPage: 20,
        algoliaAppId: process.env.ALGOLIA_APP_ID!,
        algoliaSearchApiKey: process.env.ALGOLIA_SEARCH_API_KEY!,
        suggestedLinks: [
          {
            label: 'Quickstart',
            description: 'Get up and running with Mastra',
            link: '/guides/getting-started/quickstart',
          },
          { label: 'Studio', description: 'Test your agents, workflows, and tools', link: '/docs/studio/overview' },
          {
            label: 'Agents',
            description: 'Use LLMs and tools to solve open-ended tasks',
            link: '/docs/agents/overview',
          },
          { label: 'Memory', description: 'Manage agent context across conversations', link: '/docs/memory/overview' },
          {
            label: 'Workflows',
            description: 'Define and manage complex sequences of tasks',
            link: '/docs/workflows/overview',
          },
          {
            label: 'Streaming',
            description: 'Streaming for real-time agent interactions',
            link: '/docs/streaming/overview',
          },
          { label: 'MCP', description: 'Connect agents to external tools and resources', link: '/docs/mcp/overview' },
          { label: 'Evals', description: 'Evaluate agent performance', link: '/docs/evals/overview' },
          {
            label: 'Observability',
            description: 'Monitor and log agent activity',
            link: '/docs/observability/overview',
          },
          {
            label: 'Deployment',
            description: 'Deploy your agents, workflows, and tools',
            link: '/docs/deployment/overview',
          },
        ],
      } satisfies AlgoliaPluginOptions,
    ],
  ],
  themes: kapaThemes,
  presets: [
    [
      'classic',
      {
        docs: {
          path: 'src/content/en/docs',
          routeBasePath: 'docs',
          sidebarPath: './src/content/en/docs/sidebars.js',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: 'https://github.com/mastra-ai/mastra/tree/main/docs',
          admonitions: ADMONITIONS_CONFIG,
          remarkPlugins: [...SHARED_REMARK_PLUGINS],
        },
        blog: false,
        theme: {
          customCss: './custom.css',
        },
        sitemap: {
          lastmod: 'date',
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: ['/tags/**'],
          filename: 'sitemap.xml',
        },
      },
    ],
  ],
  themeConfig: {
    image: 'img/og-image.png',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    prism: {
      // @ts-expect-error: FIXME
      theme: prismMastraLight,
      // @ts-expect-error: FIXME
      darkTheme: prismMastraDark,
      additionalLanguages: ['diff', 'bash'],
    },
  } satisfies ThemeConfig,
}

export default config
