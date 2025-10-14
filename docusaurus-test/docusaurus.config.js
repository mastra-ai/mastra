// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import { themes as prismThemes } from 'prism-react-renderer';
import prismMastraLight from './src/theme/prism-mastra-light.js';
import prismMastraDark from './src/theme/prism-mastra-dark.js';

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

  // Custom fields for Algolia search
  customFields: {
    algoliaAppId: process.env.ALGOLIA_APP_ID,
    algoliaSearchApiKey: process.env.ALGOLIA_SEARCH_API_KEY,
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
            title: 'Documentation',
            items: [
              {
                label: 'Introduction',
                to: '/docs/intro',
              },
              {
                label: 'Getting Started',
                to: '/docs/getting-started/installation',
              },
              {
                label: 'Examples',
                to: '/docs/examples',
              },
              {
                label: 'Guides',
                to: '/docs/guides',
              },
            ],
          },
          {
            title: 'Resources',
            items: [
              {
                label: 'Reference',
                to: '/docs/reference',
              },
              {
                label: 'Models',
                to: '/docs/models',
              },
              {
                label: 'Showcase',
                to: '/showcase',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Discord',
                href: 'https://discord.gg/mastra',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/mastra-ai/mastra',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/mastra_ai',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Mastra.`,
      },
      prism: {
        theme: prismMastraLight,
        darkTheme: prismMastraDark,
      },
    }),
};

export default config;
