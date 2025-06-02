import type { NextConfig } from "next";
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";
import { resolve } from "path";

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

    config.resolve.alias = {
      ...config.resolve.alias,
      "@libsql/client": resolve("./node_modules/@libsql/client"),
    };

    return config;
  },
};

export default nextConfig;
