import { existsSync, mkdir, mkdirSync, readFileSync, writeFile, writeFileSync } from 'fs';
import path from 'path';

export class VercelJsonService {
  async writeCronConfig({ cronPath, cronSchedule }: { cronPath: string; cronSchedule: string }): Promise<void> {
    const cronInstance = {
      path: cronPath,
      schedule: cronSchedule,
    };
    const MASTRA_APP_DIR = process.env.MASTRA_APP_DIR || process.cwd();
    const configPath = path.join(MASTRA_APP_DIR, 'vercel.json');
    if (!existsSync(configPath)) {
      return writeFileSync(
        configPath,
        JSON.stringify({
          crons: [cronInstance],
        }),
      );
    }

    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    config.crons.push(cronInstance);
    return writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  }
}
