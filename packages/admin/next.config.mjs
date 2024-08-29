import fs from 'fs';
import path from 'path';

function getConfigPath() {
  if (process.env.ARK_APP_DIR) {
    const configPath = path.resolve(process.env.ARK_APP_DIR, 'arkw.config');
    if (fs.existsSync(configPath + '.ts')) {
      return configPath;
    }
  }
  return path.resolve(process.cwd(), 'example.arkw.config');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: 'loose',
  },
  env: {
    CONFIG_PATH: getConfigPath(),
    APP_DIR: process.env.ARK_APP_DIR,
    APP_URL: 'http://localhost:3456', // Override the user's app URL for admin
  },
  redirects() {
    return [
      {
        source: '/',
        destination: '/integrations',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
