import { join } from "path/posix";
import prismMastraDark from "./src/theme/prism-mastra-dark.js";
import prismMastraLight from "./src/theme/prism-mastra-light.js";
import "dotenv/config";
import type { Config } from "@docusaurus/types";

const config: Config = {
  title: "Mastra Docs v1 Beta",
  tagline: "TypeScript agent framework",
  favicon: "/img/favicon.ico",

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
    parseFrontMatter: async (params) => {
      const result = await params.defaultParseFrontMatter(params);
      result.frontMatter.description = `Mastra v1 Beta: ${result.frontMatter.description}`;
      return result;
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
            for (const plugin of config.plugins || []) {
              if (
                plugin &&
                plugin.constructor.name === "CssExtractRspackPlugin"
              ) {
                (plugin as any).options.filename = join(
                  "v1",
                  (plugin as any).options.filename,
                );
                (plugin as any).options.chunkFilename = join(
                  "v1",
                  (plugin as any).options.chunkFilename,
                );
              }
            }
            const filename = config.output?.filename as string;
            const chunkFilename = config.output?.chunkFilename as string;
            return {
              plugins: config.plugins,
              output: {
                filename: join("v1", filename),
                chunkFilename: join("v1", chunkFilename),
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
      {
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
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    {
      colorMode: {
        respectPrefersColorScheme: true,
      },
      navbar: {
        logo: {
          alt: "Mastra Logo",
          src: "logo.svg",
        },
      },
      prism: {
        theme: prismMastraLight,
        darkTheme: prismMastraDark,
        additionalLanguages: ["diff", "bash"],
      },
    },
};

export default config;
