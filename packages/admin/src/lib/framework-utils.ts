import { createFramework } from '@arkw/core';
import fs from 'fs';
import path from 'path';

export async function getFramework() {
  try {
    const configFilePath = getConfigPath();
    console.log('configFilePath:', configFilePath);
    //const { config } = await import('/Users/shanethomas/dev/kepler/future/packages/admin/example.future.config');
    const { config } = require(configFilePath);

    return createFramework(config);
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

export function getConfigPath() {
  if (process.env.ARK_APP_DIR) {
    const configPath = path.resolve(process.env.ARK_APP_DIR, 'arkw.config');
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }
  return path.resolve(process.cwd(), 'example.future.config');
}

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
