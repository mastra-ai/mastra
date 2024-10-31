import { execa } from 'execa';

import { EnvService } from './service.env';

export class VercelEnvService extends EnvService {
  async getEnvValue(key: string): Promise<string | null> {
    try {
      const { stdout } = await execa('vercel', ['env', 'get', key]);
      return stdout;
    } catch (err) {
      console.error(`Error getting ENV value from Vercel: ${err}`);
      return null;
    }
  }

  async setEnvValue(key: string, value: string): Promise<void> {
    try {
      await execa('vercel', ['env', 'add', key, value]);
      console.log(`${key} set to ${value} in Vercel ENV.`);
    } catch (err) {
      console.error(`Error setting ENV value in Vercel: ${err}`);
    }
  }
}
