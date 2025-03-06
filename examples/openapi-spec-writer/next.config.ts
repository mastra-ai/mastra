import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
  serverExternalPackages: ["@mastra/*"],

  webpack: (config, { isServer }) => {
    // Handle native node modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "onnxruntime-node": false,
      };
    }

    // Handle .node files
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };

    config.module = {
      ...config.module,
      exprContextCritical: false,
      noParse: [/onnxruntime-node/],
    };

    return config;
  },
};

export default nextConfig;
