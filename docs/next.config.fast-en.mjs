/** @type {import('next').NextConfig} */
import nextra from "nextra";
import { initGT } from "gt-next/config";
import { transformerNotationDiff } from "@shikijs/transformers";
import path from "path";
import { readFileSync } from "fs";
import { redirectList } from "./config/redirects.mjs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Optimized Nextra config for development
const withNextra = nextra({
  search: {
    codeblocks: false, // Disable code block indexing for speed
  },
  mdxOptions: {
    rehypePrettyCodeOptions: {
      theme: "github-light", // Simple theme for faster processing
      transformers: [], // Skip transformers in dev
    },
  },
  unstable_shouldAddLocaleToLinks: true,
});

// Minimal GT config - disabled for development
const withGT = initGT({
  runtimeUrl: "", // Disable runtime translation completely
});

export default withGT(
  withNextra({
    assetPrefix: "",

    // Keep i18n but only with English locale for faster processing
    i18n: {
      locales: ["en"], // Only English in dev mode
      defaultLocale: "en",
    },

    async rewrites() {
      return {
        beforeFiles: [
          // API routes
          {
            source: "/en/docs/api/copilotkit",
            destination: "/api/copilotkit",
          },
          {
            source: "/docs/api/copilotkit",
            destination: "/api/copilotkit",
          },
          {
            source: "/en/docs/api/feedback",
            destination: "/api/feedback",
          },
          {
            source: "/docs/api/feedback",
            destination: "/api/feedback",
          },
          {
            source: "/:locale/docs/_next/:path+",
            destination: "/_next/:path+",
          },
          {
            source: "/docs/_next/:path+",
            destination: "/_next/:path+",
          },
        ],
      };
    },

    redirects: () => [], // Skip redirects in dev for speed
    trailingSlash: false,

    // Development optimizations
    reactStrictMode: false,
    productionBrowserSourceMaps: false,

    // Skip checks in development
    eslint: {
      ignoreDuringBuilds: true,
    },
    typescript: {
      ignoreBuildErrors: true,
    },

    // Experimental optimizations
    experimental: {
      optimizeCss: false,
      optimizePackageImports: [
        "react",
        "react-dom",
        "next",
        "nextra",
        "nextra-theme-docs",
      ],
    },

    // Custom webpack config for development
    webpack: (config, { dev, isServer }) => {
      if (dev) {
        // Faster builds with less optimization
        config.optimization = {
          ...config.optimization,
          minimize: false,
          splitChunks: false,
          runtimeChunk: false,
          removeAvailableModules: false,
          removeEmptyChunks: false,
          concatenateModules: false,
        };

        // Disable performance hints
        config.performance = {
          hints: false,
        };

        // Use filesystem cache
        config.cache = {
          type: "filesystem",
          buildDependencies: {
            config: [__filename],
          },
        };
      }

      return config;
    },

    // Disable image optimization in dev
    images: {
      unoptimized: true,
    },

    // Fix workspace root warning
    outputFileTracingRoot: path.join(__dirname, "../"),
  }),
);
