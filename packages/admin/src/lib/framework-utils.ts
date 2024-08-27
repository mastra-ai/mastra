import { createFramework } from '@arkw/core';
import fs from 'fs';
import path from 'path';

function getFramework() {
  try {
    const { config } = require(process.env.CONFIG_PATH!);
    const framework = createFramework(config);
    return { framework, config };
  } catch (error) {
    console.error('Error loading config:', error);
    return { framework: null, config: null };
  }
}

export const { framework, config } = getFramework();

// @todo: the .env file should be able to be set to .env.local somehow
// possibly defined in the config file?
export function getEnvPath() {
  if (process.env.ARK_APP_DIR) {
    const envPath = path.resolve(process.env.ARK_APP_DIR, '.env');
    if (fs.existsSync(envPath)) {
      return envPath;
    }
  }
  return path.resolve(process.cwd(), '.env');
}
