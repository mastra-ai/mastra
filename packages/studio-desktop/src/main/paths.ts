import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const thisFile = fileURLToPath(import.meta.url);
const thisDir = dirname(thisFile);

export function resolveStudioDistPath({ packaged, resourcesPath }: { packaged: boolean; resourcesPath: string }) {
  if (process.env.MASTRA_DESKTOP_STUDIO_DIST) {
    return resolve(process.env.MASTRA_DESKTOP_STUDIO_DIST);
  }

  if (packaged) {
    return join(resourcesPath, 'studio');
  }

  const playgroundPackagePath = require.resolve('@internal/playground/package.json');
  return join(dirname(playgroundPackagePath), 'dist');
}

export function resolveStarterOutputPath({ packaged, resourcesPath }: { packaged: boolean; resourcesPath: string }) {
  if (process.env.MASTRA_DESKTOP_STARTER_OUTPUT) {
    return resolve(process.env.MASTRA_DESKTOP_STARTER_OUTPUT);
  }

  if (packaged) {
    return join(resourcesPath, 'starter-output');
  }

  return resolve(thisDir, '../../.mastra/output');
}

export function resolveAppIconPath({ packaged, resourcesPath }: { packaged: boolean; resourcesPath: string }) {
  if (process.env.MASTRA_DESKTOP_ICON) {
    return resolve(process.env.MASTRA_DESKTOP_ICON);
  }

  if (packaged) {
    return join(resourcesPath, 'icon.png');
  }

  return resolve(thisDir, '../../build/icon.png');
}
