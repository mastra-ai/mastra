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

export async function dev({ port, env, dir }: { dir?: string; port: number; env: Record<string, any> }) {
  const dotMastraPath = join(process.cwd(), '.mastra');
  const agentChatServePath = join(dotMastraPath, 'agent-chat');
  const homepageServePath = join(dotMastraPath, 'homepage');
  const key = env[0]?.name;
  const value = env[0]?.value;

  // Ensure agent-chat directory exists
  await fsExtra.ensureDir(agentChatServePath);
  await fsExtra.ensureDir(homepageServePath);
  // Copy agent-chat dist files
  await fsExtra.copy(join(path.dirname(path.dirname(__dirname)), 'src/chat/agent/dist'), agentChatServePath, {
    overwrite: true,
  });
  // Copy homepage dist files
  await fsExtra.copy(join(path.dirname(path.dirname(__dirname)), 'src/homepage/dist'), homepageServePath, {
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

  writeFileSync(join(dotMastraPath, 'index.mjs'), EXPRESS_SERVER);

  await bundleServer(join(dotMastraPath, 'index.mjs'));

  const proc = execa('node', ['server.mjs'], {
    cwd: dotMastraPath,
    env: {
      port: `${port} || 4111`,
    },
  });

  proc.stdout.pipe(process.stdout);
  proc.stderr.pipe(process.stderr);

  return proc;
}
