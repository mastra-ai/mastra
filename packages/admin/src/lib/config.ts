import { createFramework } from '@arkw/core';
import path from 'path';

const configFilePath = process.env.CONFIG_FILE_PATH || path.resolve(process.cwd(), 'example.future.config.ts');
const resolvedPath = path.resolve(process.cwd(), configFilePath);

let framework: any; // TODO: Fix type.

(async () => {
  try {
    const { config } = await import(resolvedPath);
    framework = createFramework(config);
  } catch (error) {
    console.error('Error loading config:', error);
  }
})();

export { framework };
