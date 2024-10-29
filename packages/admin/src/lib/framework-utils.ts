import { Mastra } from '@mastra/core';
import fs from 'fs';
import path from 'path';

function getFramework() {
  try {
    // const { config } = require(process.env.CONFIG_PATH!);
    //change back to use env config path, this only works in stand-alone admin

    const { config } = require(path.join('../../', 'example.mastra.config.ts'));

    const framework = Mastra.init(config);

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
  if (process.env.MASTRA_APP_DIR) {
    const envPath = path.resolve(process.env.MASTRA_APP_DIR, '.env');
    if (fs.existsSync(envPath)) {
      return envPath;
    }
  }
  return path.resolve(process.cwd(), '.env');
}
