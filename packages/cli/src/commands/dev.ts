import { config } from 'dotenv';
import { execa } from 'execa';
import { writeFileSync } from 'fs';
import { join } from 'path';
import path from 'path';
import { fileURLToPath } from 'url';

import fsExtra from 'fs-extra/esm';
import fs from 'fs/promises';

import { FileService } from '../services/service.file.js';
import { bundle, bundleServer } from '../utils/bundle.js';

import { EXPRESS_SERVER } from './deploy/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function dev({
  port,
  env,
  dir,
  devTools,
}: {
  dir?: string;
  port: number;
  env: Record<string, any>;
  devTools?: string;
}) {
  const dotMastraPath = join(process.cwd(), '.mastra');
  const playgroundServePath = join(dotMastraPath, 'playground');
  const key = env[0]?.name;
  const value = env[0]?.value;

  // Copy playground dist files
  await fsExtra.copy(join(path.dirname(path.dirname(__dirname)), 'src/playground/dist'), playgroundServePath, {
    overwrite: true,
  });

  try {
    const fileService = new FileService();
    const envFile = fileService.getFirstExistingFile(['.env.development', '.env']);
    config({ path: envFile });
  } catch (err) {
    //create .env file
    await fsExtra.ensureFile('.env');
    await fs.writeFile(path.join(process.cwd(), '.env'), `${key}=${value}`);
  }

  const dirPath = dir || path.join(process.cwd(), 'src/mastra');
  await bundle(dirPath);

  // Bundle devTools if path is provided
  if (devTools) {
    const devToolsPath = path.isAbsolute(devTools) ? devTools : path.join(process.cwd(), devTools);
    await bundle(devToolsPath, {
      outfile: join(dotMastraPath, 'devTools.mjs'),
    });
  }

  writeFileSync(join(dotMastraPath, 'index.mjs'), EXPRESS_SERVER);

  await bundleServer(join(dotMastraPath, 'index.mjs'));

  const proc = execa('node', ['server.mjs'], {
    cwd: dotMastraPath,
    env: {
      port: `${port} || 4111`,
      MASTRA_DEV_TOOLS: devTools ? 'true' : 'false',
      MASTRA_DEV_TOOLS_PATH: devTools ? join(dotMastraPath, 'devTools.mjs') : '',
    },
  });

  proc.stdout.pipe(process.stdout);
  proc.stderr.pipe(process.stderr);

  return proc;
}
