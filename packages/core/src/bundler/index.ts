import { readFile } from 'fs/promises';
import { parse } from 'dotenv';

import { MastraBase } from '../base';

export interface IBundler {
  loadEnvVars(): Promise<Map<string, string>>;
  getEnvFiles(): Promise<string[]>;
  bundle(entryFile: string, outputDirectory: string, toolsPaths: string[]): Promise<void>;
  prepare(outputDirectory: string): Promise<void>;
  writePackageJson(outputDirectory: string, dependencies: Map<string, string>): Promise<void>;
}

export abstract class MastraBundler extends MastraBase implements IBundler {
  constructor({ name, component = 'BUNDLER' }: { name: string; component?: 'BUNDLER' | 'DEPLOYER' }) {
    super({ component, name });
  }

  async loadEnvVars(): Promise<Map<string, string>> {
    const envVars = new Map();

    for (const file of await this.getEnvFiles()) {
      const content = await readFile(file, 'utf-8');
      const config = parse(content);

      Object.entries(config).forEach(([key, value]) => {
        envVars.set(key, value);
      });
    }

    return envVars;
  }

  abstract prepare(outputDirectory: string): Promise<void>;
  abstract writePackageJson(outputDirectory: string, dependencies: Map<string, string>): Promise<void>;
  abstract writeInstrumentationFile(outputDirectory: string): Promise<void>;
  abstract getEnvFiles(): Promise<string[]>;
  abstract bundle(entryFile: string, outputDirectory: string, toolsPaths: string[]): Promise<void>;
}
