// @ts-ignore
import * as MastraConfig from '!!CONFIG_PATH!!';
// @ts-ignore
import { Mastra } from '@mastra/core';
import fs from 'fs';
import path from 'path';

const _config = MastraConfig.config;

function getFramework() {
  try {
    const framework = Mastra.init(MastraConfig.config);

    return { framework, config: _config };
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
