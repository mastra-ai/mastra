import { PrismaPlugin } from '@prisma/nextjs-monorepo-workaround-plugin';
import fs from 'fs';
import path from 'path';

const cwd = process.cwd();

function getConfigPath() {
  if (process.env.MASTRA_APP_DIR) {
    const configPath = path.resolve(process.env.MASTRA_APP_DIR, 'mastra.config');
    if (fs.existsSync(configPath + '.ts')) {
      return configPath;
    }
  }
  return path.resolve(process.cwd(), 'example.mastra.config');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    CONFIG_PATH: getConfigPath(),
    APP_DIR: process.env.MASTRA_APP_DIR,
    APP_URL: 'http://localhost:3456', // Override the user's app URL for admin
  },
  redirects() {
    return [
      {
        source: '/',
        destination: '/agents',
        permanent: false,
      },
    ];
  },
  experimental: {
    turbo: {
      rules: {
        '*.md': {
          loaders: ['raw-loader'],
          as: '*.js',
        },
        '*.tsbuildinfo': {
          loaders: ['raw-loader'],
          as: '*.js',
        },
        '*.yaml': {
          loaders: ['yaml-loader'],
          as: '*.js',
        },
      },
      ...(cwd.includes('/cli/admin') ? {} : { root: path.resolve(cwd, '../../') }),
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()];
    }

    return config;
  },
};

export default nextConfig;
