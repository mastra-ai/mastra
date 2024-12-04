import { config } from 'dotenv';
import { join } from 'path';
import path from 'path';

import fsExtra from 'fs-extra/esm';
import fs from 'fs/promises';

import { getFirstExistingFile } from '../utils.js';
import { bundle } from '../utils/bundle.js';
import { writeFileSync } from 'fs';
import { EXPRESS_SERVER } from './deploy/server.js';
import { execa } from 'execa';

export async function serve(port: number, env: Record<string, any>) {
  const dotMastraPath = join(process.cwd(), '.mastra');
  const key = env[0]?.name;
  const value = env[0]?.value;

  try {
    const envFile = getFirstExistingFile(['.env.development', '.env']);
    config({ path: envFile });
  } catch (err) {
    //create .env file
    await fsExtra.ensureFile('.env');
    await fs.writeFile(path.join(process.cwd(), '.env'), `${key}=${value}`);
  }

  await bundle();

  writeFileSync(join(dotMastraPath, 'index.mjs'), EXPRESS_SERVER);

  const proc = execa('node', ['index.mjs'], {
    cwd: dotMastraPath,
    env: {
      port: `${port} || 4111`,
    }
  })

  proc.stdout.pipe(process.stdout);
  proc.stderr.pipe(process.stderr);

  return proc;
}
