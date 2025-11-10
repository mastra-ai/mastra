// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import { join } from "path/posix";
import prismMastraDark from "./src/theme/prism-mastra-dark.js";
import prismMastraLight from "./src/theme/prism-mastra-light.js";
import "dotenv/config";

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Mastra Documentation",
  tagline: "TypeScript agent framework",
  favicon: "/favicon.ico",

  // Set the production url of your site here
  url: "https://mastra.ai",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/",

  onBrokenLinks: "throw",

  // Markdown configuration
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },
  // Enable v4 features in prod

  ...(process.env.NODE_ENV === "production" && {
    future: {
      v4: {
        useCssCascadeLayers: false,
        removeLegacyPostBuildHeadAttribute: true,
      },
      experimental_faster: true,
    },
  }),

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
  },

  // Preconnect to Google Fonts
  headTags: [
    {
      tagName: "link",
      attributes: {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
    },
    {
      tagName: "link",
      attributes: {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossorigin: "anonymous",
      },
    },
  ],

  plugins: [
    // PostHog analytics (only enabled if POSTHOG_API_KEY is set)
    ...(process.env.POSTHOG_API_KEY
      ? [
          [
            "posthog-docusaurus",
            {
              apiKey: process.env.POSTHOG_API_KEY,
              appUrl: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
              enableInDevelopment: false,
            },
          ],
        ]
      : []),
    // Vercel Analytics (automatically enabled in production on Vercel)
    [
      "@docusaurus/plugin-vercel-analytics",
      {
        debug: false,
        mode: "auto",
      },
    ],
    [
      "@docusaurus/plugin-content-docs",
      {
        id: "models",
        path: "src/content/en/models",
        routeBasePath: "models/v1",
        sidebarPath: "./src/content/en/models/sidebars.js",
        editUrl: "https://github.com/mastra-ai/mastra/tree/main/docs",
      },
    ],
    [
      "@docusaurus/plugin-content-docs",
      {
        id: "guides",
        path: "src/content/en/guides",
        routeBasePath: "guides/v1",
        sidebarPath: "./src/content/en/guides/sidebars.js",
        editUrl: "https://github.com/mastra-ai/mastra/tree/main/docs",
      },
    ],
    [
      "@docusaurus/plugin-content-docs",
      {
        id: "examples",
        path: "src/content/en/examples",
        routeBasePath: "examples/v1",
        sidebarPath: "./src/content/en/examples/sidebars.js",
        editUrl: "https://github.com/mastra-ai/mastra/tree/main/docs",
      },
    ],
    [
      "@docusaurus/plugin-content-docs",
      {
        id: "reference",
        path: "src/content/en/reference",
        routeBasePath: "reference/v1",
        sidebarPath: "./src/content/en/reference/sidebars.js",
        editUrl: "https://github.com/mastra-ai/mastra/tree/main/docs",
      },
    ],
    function assetPlugin() {
      return {
        name: "asset-plugin",
        configureWebpack(config, isServer, utils, content) {
          if (!isServer) {
            for (const plugin of config.plugins) {
              if (plugin.constructor.name === "CssExtractRspackPlugin") {
                plugin.options.filename = join("v1", plugin.options.filename);
                plugin.options.chunkFilename = join(
                  "v1",
                  plugin.options.chunkFilename,
                );
              }
            }

            return {
              plugins: config.plugins,
              output: {
                filename: join("v1", config.output?.filename),
                chunkFilename: join("v1", config.output?.chunkFilename),
              },
            };
          }
        },
      };
    },
  ],

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          path: "src/content/en/docs",
          routeBasePath: "docs/v1",
          sidebarPath: "./src/content/en/docs/sidebars.js",
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl: "https://github.com/mastra-ai/mastra/tree/main/docs",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
        sitemap: {
          lastmod: "date",
          changefreq: "weekly",
          priority: 0.5,
          ignorePatterns: ["/tags/**"],
          filename: "sitemap.xml",
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        logo: {
          alt: "Mastra Logo",
          src: "logo.svg",
        },
      },
      footer: {
        links: [
          {
            title: "Developer",
            items: [
              {
                label: "Docs",
                to: "/docs/v1",
              },

              {
                label: "Templates",
                href: `https://mastra.ai/templates`,
              },
              {
                label: "Principles of Building AI Agents",
                href: `https://mastra.ai/book`,
              },

              {
                label: "llms.txt",
                href: `https://mastra.ai/llms.txt`,
              },

              {
                label: "llms-full.txt",
                href: `https://mastra.ai/llms-full.txt`,
              },
              {
                label: "MCP Registry Registry",
                href: `https://mastra.ai/mcp-registry-registry`,
              },
              {
                label: "Mastra Cloud Status",
                href: "https://statuspage.incident.io/mastra-cloud",
              },
            ],
          },
          {
            title: "Company",
            items: [
              {
                label: "GitHub",
                href: "https://github.com/mastra-ai/mastra",
              },
              {
                label: "Discord",
                href: "https://discord.gg/BTYqqHKUrf",
              },
              {
                label: "X",
                href: "https://x.com/mastra_ai",
              },
              {
                label: "YouTube",
                href: "https://www.youtube.com/@mastra-ai",
              },
            ],
          },
          {
            title: "Legal",
            items: [
              {
                label: "Privacy Policy",
                href: `https://mastra.ai/privacy-policy`,
              },
            ],
          },
        ],
        copyright: `© ${new Date().getFullYear()} Mastra.`,
      },
      prism: {
        theme: prismMastraLight,
        darkTheme: prismMastraDark,
        additionalLanguages: ["diff"],
      },
    }),
};

export default config;
