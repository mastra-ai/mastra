/** @type {import('next').NextConfig} */
import nextra from "nextra";
import { transformerNotationDiff } from "@shikijs/transformers";
import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Minimal redirects for development
const devRedirects = [
  // Only include the most essential redirects needed for development
];

// Fast development configuration - English only, minimal processing
const withNextra = nextra({
  search: {
    codeblocks: false, // Disable code block indexing
  },
  mdxOptions: {
    // Simpler theme for development
    rehypePrettyCodeOptions: {
      theme: "github-light", // Use a simple theme instead of custom
      transformers: [], // Skip transformers in dev
    },
  },
  unstable_shouldAddLocaleToLinks: false,
});

export default withNextra({
  assetPrefix: "",

  // No i18n - single locale only
  // This completely removes i18n processing overhead

  async rewrites() {
    return {
      beforeFiles: [
        // Map root paths to English content
        {
          source: "/docs/:path*",
          destination: "/en/docs/:path*",
        },
        // API routes
        {
          source: "/api/copilotkit",
          destination: "/api/copilotkit",
        },
        {
          source: "/api/feedback",
          destination: "/api/feedback",
        },
        {
          source: "/_next/:path+",
          destination: "/_next/:path+",
        },
      ],
    };
  },

  redirects: () => devRedirects,
  trailingSlash: false,

  // Aggressive development optimizations
  reactStrictMode: false,
  productionBrowserSourceMaps: false,

  // Skip all checks in development
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Experimental features for faster dev
  experimental: {
    optimizeCss: false,
    optimizePackageImports: [
      // Only optimize the most commonly used packages
      "react",
      "react-dom",
      "next",
    ],
  },

  // Custom webpack config for development
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Disable all optimizations for faster builds
      config.optimization = {
        ...config.optimization,
        minimize: false,
        splitChunks: false,
        runtimeChunk: false,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        concatenateModules: false,
        usedExports: false,
        providedExports: false,
        sideEffects: false,
        moduleIds: "named",
        chunkIds: "named",
      };

      // Increase performance budgets
      config.performance = {
        hints: false,
      };

      // Skip parsing of large libraries
      config.module.noParse = [/node_modules\/.*\.min\.js$/];

      // Add cache configuration
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

  // Output configuration
  output: "standalone",

  // Fix workspace root warning
  outputFileTracingRoot: path.join(__dirname, "../"),
});
