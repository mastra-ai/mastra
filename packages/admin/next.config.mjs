import fs from 'fs';
import path from 'path';

function getConfigPath() {
  if (process.env.ARK_APP_DIR) {
    const configPath = path.resolve(process.env.ARK_APP_DIR, 'arkw.config');
    if (fs.existsSync(configPath + '.ts')) {
      return configPath;
    }
  }
  return path.resolve(process.cwd(), 'example.future.config');
}

function getAdminUrl() {
  const defaultPort = process.env.ARK_APP_DIR ? '3456' : '3000';
  return `http://localhost:${process.env.PORT || defaultPort}`;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: 'loose',
  },
  env: {
    CONFIG_PATH: getConfigPath(),
    APP_DIR: process.env.ARK_APP_DIR,
    APP_URL: getAdminUrl(), // Override the user's app URL for admin
  },
};

export default nextConfig;
