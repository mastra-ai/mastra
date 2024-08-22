import path from 'path';

function getConfigPath() {
  if (process.env.ARK_APP_DIR) {
    const configPath = path.resolve(process.env.ARK_APP_DIR, 'arkw.config');
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }
  return path.resolve(process.cwd(), 'example.future.config');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: 'loose',
  },
  env: {
    CONFIG_PATH: getConfigPath()
  }
};

export default nextConfig;
