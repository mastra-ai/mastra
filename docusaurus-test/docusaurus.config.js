// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';
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
          editUrl:
            'https://github.com/mastra-ai/mastra/tree/main/docs/',
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
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            type: 'docSidebar',
            sidebarId: 'examplesSidebar',
            position: 'left',
            label: 'Examples',
          },
          {
            type: 'docSidebar',
            sidebarId: 'guidesSidebar',
            position: 'left',
            label: 'Guides',
          },
          {
            type: 'docSidebar',
            sidebarId: 'referenceSidebar',
            position: 'left',
            label: 'Reference',
          },
          {
            type: 'docSidebar',
            sidebarId: 'modelsSidebar',
            position: 'left',
            label: 'Models',
          },
          {
            to: '/showcase',
            label: 'Showcase',
            position: 'left',
          },
          {
            href: 'https://github.com/mastra-ai/mastra',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
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
