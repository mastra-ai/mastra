import dotenv from 'dotenv';

import { readFile } from 'fs/promises';

import { MastraBase } from '../base';

export abstract class MastraBundler extends MastraBase {
  constructor({ name, component = 'BUNDLER' }: { name: string; component?: 'BUNDLER' | 'DEPLOYER' }) {
    super({ component, name });
  }

  async loadEnvVars(): Promise<Map<string, string>> {
    const envVars = new Map();

    for (const file of await this.getEnvFiles()) {
      const content = await readFile(file, 'utf-8');
      const config = dotenv.parse(content);

      Object.entries(config).forEach(([key, value]) => {
        envVars.set(key, value);
      });
    }

    return envVars;
  }

  abstract prepare(outputDirectory: string): Promise<void>;
  abstract getEnvFiles(): Promise<string[]>;
  abstract bundle(mastraDir: string, outputDirectory: string): Promise<void>;
}
