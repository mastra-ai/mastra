import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: [
    "@mastra/core",
    "@mastra/engine",
    "@mastra/firecrawl",
    "@mastra/github",
  ],
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has TypeScript errors.
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["onnxruntime-node"],
  // webpack externals
  webpack: (config) => {
    config.externals = [...config.externals, "onnxruntime-node"];
    return config;
  },
};

export default nextConfig;
