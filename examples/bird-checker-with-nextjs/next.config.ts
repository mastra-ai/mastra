import type { NextConfig } from "next";
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ["@mastra/*"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
      },
    ],
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
