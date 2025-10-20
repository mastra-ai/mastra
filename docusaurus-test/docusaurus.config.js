// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import prismMastraDark from './src/theme/prism-mastra-dark.js';
import prismMastraLight from './src/theme/prism-mastra-light.js';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Mastra Documentation',
  tagline: 'TypeScript agent framework',
  favicon: 'favicon.ico',

  // Set the production url of your site here
  url: 'https://mastra.ai',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  onBrokenLinks: 'throw',

  // Markdown configuration
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  // Custom fields for Algolia search and HubSpot
  customFields: {
    algoliaAppId: process.env.ALGOLIA_APP_ID,
    algoliaSearchApiKey: process.env.ALGOLIA_SEARCH_API_KEY,
    hsPortalId: process.env.HS_PORTAL_ID,
    hsFormGuid: process.env.HS_FORM_GUID,
   mastraWebsite: process.env.MASTRA_WEBSITE,
  },

  // Preconnect to Google Fonts
  headTags: [
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossorigin: 'anonymous',
      },
    },
  ],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: 'https://github.com/mastra-ai/mastra/tree/main/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        logo: {
          alt: 'Mastra Logo',
          src: 'logo.svg',
        },
      },
      footer: {
        links: [
          {
            title: 'Developer',
            items: [
              {
                label: 'Docs',
                to: '/docs',
              },
              {
                label: 'Templates',
                to: '/templates',
              },
              {
                label: 'Principles of Building AI Agents',
                to: '/book',
              },
              {
                label: 'llms.txt',
                to: '/llms.txt',
              },
              {
                label: 'llms-full.txt',
                to: '/llms-full.txt',
              },
              {
                label: 'MCP Registry Registry',
                to: '/mcp-registry-registry',
              },
              {
                label: 'Mastra Cloud Status',
                href: 'https://statuspage.incident.io/mastra-cloud',
              },
            ],
          },
          {
            title: 'Company',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/mastra-ai/mastra',
              },
              {
                label: 'Discord',
                href: 'https://discord.gg/BTYqqHKUrf',
              },
              {
                label: 'X',
                href: 'https://x.com/mastra_ai',
              },
              {
                label: 'YouTube',
                href: 'https://www.youtube.com/@mastra-ai',
              },
            ],
          },
          {
            title: 'Legal',
            items: [
              {
                label: 'Privacy Policy',
                to: '/privacy-policy',
              },
            ],
          },
        ],
        copyright: `© ${new Date().getFullYear()} Mastra.`,
      },
      prism: {
        theme: prismMastraLight,
        darkTheme: prismMastraDark,
      },
    }),
};

export default config;
