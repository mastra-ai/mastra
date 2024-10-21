import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

export class VercelJsonService {
  async writeCronConfig({ cronPath, cronSchedule }: { cronPath: string; cronSchedule: string }): Promise<void> {
    const cronInstance = {
      path: cronPath,
      schedule: cronSchedule,
    };

    const MASTRA_APP_DIR = process.env.MASTRA_APP_DIR || process.cwd();
    const configPath = path.join(MASTRA_APP_DIR, 'vercel.json');
    const configDir = path.dirname(configPath);

    console.log(`Writing cron configuration to ${configPath}`);

    try {
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }

      if (!existsSync(configPath)) {
        return writeFileSync(
          configPath,
          JSON.stringify(
            {
              crons: [cronInstance],
            },
            null,
            2,
          ),
          'utf-8',
        );
      }

      const config = JSON.parse(readFileSync(configPath, 'utf-8'));

      if (!Array.isArray(config.crons)) {
        config.crons = [];
      }
      config.crons.push(cronInstance);

      return writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error writing to vercel.json:', error);
      throw new Error('Failed to write cron configuration.');
    }
  }
}
