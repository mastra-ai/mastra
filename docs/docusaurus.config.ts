import 'dotenv/config'
import prismMastraDark from './src/theme/prism-mastra-dark.js'
import prismMastraLight from './src/theme/prism-mastra-light.js'
import type { Config } from '@docusaurus/types'
import type { ThemeConfig } from '@docusaurus/preset-classic'

const NPM2YARN_CONFIG = { sync: true, converters: ['pnpm', 'yarn', 'bun'] }

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
    experimental_faster: true,
  },
  // Custom fields for Algolia search, HubSpot, and Analytics
  customFields: {
    algoliaAppId: process.env.ALGOLIA_APP_ID,
    algoliaSearchApiKey: process.env.ALGOLIA_SEARCH_API_KEY,
    hsPortalId: process.env.HS_PORTAL_ID,
    hsFormGuid: process.env.HS_FORM_GUID,
    mastraWebsite: process.env.MASTRA_WEBSITE,
    // Analytics
    gaId: process.env.GA_ID,
    posthogApiKey: process.env.POSTHOG_API_KEY,
    posthogHost: process.env.POSTHOG_HOST,
    kapaIntegrationId: process.env.KAPA_INTEGRATION_ID,
    kapaGroupId: process.env.KAPA_GROUP_ID,
  },
  plugins: [
    [require.resolve('./src/plugins/tailwind/tailwind-plugin'), {}],
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
        remarkPlugins: [[require('@docusaurus/remark-plugin-npm2yarn'), NPM2YARN_CONFIG]],
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
        remarkPlugins: [[require('@docusaurus/remark-plugin-npm2yarn'), NPM2YARN_CONFIG]],
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
        remarkPlugins: [[require('@docusaurus/remark-plugin-npm2yarn'), NPM2YARN_CONFIG]],
      },
    ],
    [
      require.resolve('./src/plugins/docusaurus-plugin-llms-txt'),
      {
        siteUrl: 'https://mastra.ai',
        siteTitle: 'Mastra',
        siteDescription:
          'Mastra is a framework for building AI-powered applications and agents with a modern TypeScript stack. It includes everything you need to go from early prototypes to production-ready applications. Mastra integrates with frontend and backend frameworks like React, Next.js, and Node, or you can deploy it anywhere as a standalone server.',
        excludeRoutes: ['/404'],
      },
    ],
  ],
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
          remarkPlugins: [[require('@docusaurus/remark-plugin-npm2yarn'), NPM2YARN_CONFIG]],
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
