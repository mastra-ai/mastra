import type { NextConfig } from "next";
import { resolve } from "path";

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

    config.resolve.alias = {
      ...config.resolve.alias,
      "@libsql/client": resolve("./node_modules/@libsql/client"),
    };

    return config;
  },
};

export default nextConfig;
