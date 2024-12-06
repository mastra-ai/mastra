import path from 'path';

import fse from 'fs-extra/esm';

import { FileEnvService } from '../services/service.fileEnv.js';

export async function setupEnvFile({ dbUrl }: { dbUrl: string }) {
  const envPath = path.join(process.cwd(), '.env.development');

  await fse.ensureFile(envPath);

  const fileEnvService = new FileEnvService(envPath);
  await fileEnvService.setEnvValue('DB_URL', dbUrl);
}
