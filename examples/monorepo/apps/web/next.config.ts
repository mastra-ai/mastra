import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@libsql/client": "@libsql/client/web"
    }
    return config
  }
};

export default nextConfig;
