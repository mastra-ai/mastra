import { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  generateBuildId: async () => {
    return process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());
  },
};

export default nextConfig;
