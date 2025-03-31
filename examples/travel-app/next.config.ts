import { NextConfig } from "next";
import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  serverExternalPackages: ["@mastra/*"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  generateBuildId: async () => {
    return process.env.VERCEL_GIT_COMMIT_SHA || "stable-build";
  },

  webpack: (config, { isServer }) => {
    // Handle native node modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "onnxruntime-node": false,
      };
    }

    config.module = {
      ...config.module,
      noParse: [/onnxruntime-node/],
    };

    return config;
  },
};

export default nextConfig;
