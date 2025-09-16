/** @type {import('next').NextConfig} */
import nextra from "nextra";
import { initGT } from "gt-next/config";
import { transformerNotationDiff } from "@shikijs/transformers";
import path from "path";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if we have a pre-built cache
const hasCachedBuild = existsSync(path.join(__dirname, ".mdx-cache"));

console.log(
  hasCachedBuild
    ? "✅ Using cached MDX build for faster development"
    : '⚠️  No cache found. Run "npm run prebuild" for faster development',
);

const withNextra = nextra({
  search: {
    codeblocks: false, // Disable in dev for speed
  },
  mdxOptions: {
    rehypePrettyCodeOptions: {
      theme: "github-dark", // Use simple theme
      transformers: [], // Skip transformers in dev
    },
  },
  unstable_shouldAddLocaleToLinks: true,
});

// Disable GT translations in dev
const withGT = initGT({
  runtimeUrl: "", // Disable runtime translation
});

export default withGT(
  withNextra({
    assetPrefix: "",
    i18n: {
      locales: ["en"], // English only for development
      defaultLocale: "en",
    },
    async rewrites() {
      return {
        beforeFiles: [
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
    redirects: () => [],
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

    // Aggressive caching configuration
    webpack: (config, { dev, isServer, webpack }) => {
      if (dev && !isServer) {
        // Use aggressive memory cache for client
        config.cache = true;

        // Optimize module resolution
        config.resolve = {
          ...config.resolve,
          // Cache module resolution
          unsafeCache: true,
          // Speed up resolution
          symlinks: false,
        };

        // Skip parsing of node_modules
        config.module.noParse = [
          /node_modules\/.*\.min\.js$/,
          /node_modules\/react\/.*$/,
          /node_modules\/react-dom\/.*$/,
        ];

        // Optimize for development speed
        config.optimization = {
          ...config.optimization,
          removeAvailableModules: false,
          removeEmptyChunks: false,
          splitChunks: false,
          minimize: false,
          concatenateModules: false,
          usedExports: false,
          providedExports: false,
          sideEffects: false,
          // Keep module and chunk IDs stable
          moduleIds: "deterministic",
          chunkIds: "deterministic",
          // Don't rename exports
          mangleExports: false,
        };

        // Add memory cache layer
        config.plugins.push(
          new webpack.ProvidePlugin({
            process: "process/browser",
          }),
        );

        // Use cheaper source maps
        config.devtool = "eval-cheap-module-source-map";

        // Ignore certain modules to speed up builds
        config.plugins.push(
          new webpack.IgnorePlugin({
            resourceRegExp: /^\.\/locale$/,
            contextRegExp: /moment$/,
          }),
        );
      }

      if (dev && isServer) {
        // Server-side optimizations with unique cache names
        const isEdgeServer = config.name === "edge-server";
        config.cache = {
          type: "filesystem",
          cacheDirectory: path.join(__dirname, ".next/cache/webpack"),
          name: isEdgeServer ? "dev-edge-server" : "dev-server",
          version: "1.0.0",
        };
      }

      return config;
    },

    // Experimental optimizations
    experimental: {
      optimizeCss: false,
      // Pre-compile these packages
      optimizePackageImports: [
        "nextra",
        "nextra-theme-docs",
        "react",
        "react-dom",
      ],
      // Use SWC for faster compilation
      forceSwcTransforms: true,
    },

    // Disable image optimization in dev
    images: {
      unoptimized: true,
    },

    // Output configuration
    outputFileTracingRoot: path.join(__dirname, "../"),

    // Enable on-demand entries
    onDemandEntries: {
      // Keep pages in memory for 5 minutes
      maxInactiveAge: 5 * 60 * 1000,
      // Keep up to 10 pages in memory
      pagesBufferLength: 10,
    },
  }),
);
