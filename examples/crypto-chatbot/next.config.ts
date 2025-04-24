import type { NextConfig } from 'next';
import { resolve } from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['@mastra/*'],
  experimental: {
    ppr: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: 'avatar.vercel.sh',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Handle native node modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'onnxruntime-node': false,
      };
    }

    config.module = {
      ...config.module,
      noParse: [/onnxruntime-node/],
    };

    config.resolve.alias = {
      ...config.resolve.alias,
      '@libsql/client': resolve('./node_modules/@libsql/client'),
    };

    return config;
  },
};

export default nextConfig;
