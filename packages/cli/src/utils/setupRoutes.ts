import fs from 'node:fs';
import path from 'node:path';

import { copyStarterFile } from '../lib.js';
import { config as defaultConfig } from '../starter-files/config.js';

const KPL_CONFIG_FILE = 'mastra.config.ts';
export async function setupRoutes() {
  const { routeRegistrationPath } = defaultConfig;
  const tsconfigPath = path.resolve(process.cwd(), 'tsconfig.json');
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  const mastraConfigAlias = '@mastra/config';

  if (!tsconfig.compilerOptions) {
    tsconfig.compilerOptions = {};
  }

  if (!tsconfig.compilerOptions.paths) {
    tsconfig.compilerOptions.paths = {};
  }

  if (!(mastraConfigAlias in tsconfig.compilerOptions.paths)) {
    tsconfig.compilerOptions.paths[mastraConfigAlias] = [KPL_CONFIG_FILE];
    fs.writeFileSync('tsconfig.json', JSON.stringify(tsconfig, null, 2));
  }

  const apiPath = path.join(`src/app`, routeRegistrationPath, '[...mastra]/route.ts');

  if (fs.existsSync(apiPath)) {
    console.log('Routes file already exists');
    return;
  }

  copyStarterFile('api.ts', apiPath);
}
