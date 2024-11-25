import path from 'path';

import fse from 'fs-extra/esm';

import { FileEnvService } from '../services/service.fileEnv.js';

export async function setupEnvFile({ dbUrl, adminPort }: { dbUrl: string; adminPort?: number }) {
  const envPath = path.join(process.cwd(), '.env.development');

  await fse.ensureFile(envPath);

  const fileEnvService = new FileEnvService(envPath);
  await fileEnvService.setEnvValue('DB_URL', dbUrl);
  await fileEnvService.setEnvValue('APP_URL', 'http://localhost:3000');
  await fileEnvService.setEnvValue('MASTRA_ADMIN_PORT', `${adminPort}`);
}
