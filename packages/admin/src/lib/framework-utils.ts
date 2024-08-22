import { createFramework } from '@arkw/core';
import fs from 'fs';
import path from 'path';

function getFramework() {
  try {
    const { config } = require(process.env.CONFIG_PATH!);
    return createFramework(config);
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

export const framework = getFramework();

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
