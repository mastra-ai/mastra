/** @type {import('next').NextConfig} */
import nextra from "nextra";
import { transformerNotationDiff } from "@shikijs/transformers";
import path from "path";
import { readFileSync } from "fs";
import { redirectList } from "./config/redirects.mjs";

// Development-only configuration - English only, no translations
const withNextra = nextra({
  search: {
    codeblocks: false, // Disable code block indexing in dev
  },
  mdxOptions: {
    rehypePrettyCodeOptions: {
      theme: JSON.parse(
        readFileSync(path.join(process.cwd(), "theme.json"), "utf-8"),
      ),
      transformers: [transformerNotationDiff()],
    },
  },
  unstable_shouldAddLocaleToLinks: false, // Disable in dev mode
});

export default withNextra({
  assetPrefix: "",
  // No i18n in development mode - English only
  async rewrites() {
    return {
      beforeFiles: [
        // Simplify API routes
        {
          source: "/docs/api/copilotkit",
          destination: "/api/copilotkit",
        },
        {
          source: "/docs/api/feedback",
          destination: "/api/feedback",
        },
        {
          source: "/docs/_next/:path+",
          destination: "/_next/:path+",
        },
      ],
    };
  },
  redirects: () => redirectList,
  trailingSlash: false,
  // Development optimizations
  reactStrictMode: false, // Disable double rendering in dev
  productionBrowserSourceMaps: false,
  eslint: {
    ignoreDuringBuilds: true, // Skip ESLint in dev
  },
  typescript: {
    ignoreBuildErrors: true, // Skip TypeScript errors in dev
  },
  // Webpack optimizations for dev
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Use cheaper source maps in development
      config.devtool = "eval-cheap-module-source-map";

      // Disable some optimizations in dev
      config.optimization = {
        ...config.optimization,
        minimize: false,
        splitChunks: false,
        runtimeChunk: false,
      };
    }
    return config;
  },
});
