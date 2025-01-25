import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { MastraBase } from '../base';

export abstract class MastraDeployer extends MastraBase {
  scope: string;
  projectName: string;
  env?: Record<string, any>;

  constructor({ scope, env, projectName }: { projectName: string; scope: string; env?: Record<string, any> }) {
    super({ component: 'DEPLOYER', name: 'MasterDeployer' });
    this.scope = scope;
    this.env = env;
    this.projectName = projectName;
  }

  loadEnvVars(): void {
    this.logger.debug('Loading environment variables into context.');

    this.getEnvFiles().forEach(file => {
      const content = readFileSync(file, 'utf-8');
      const config = dotenv.parse(content);
      this.env = {
        ...this.env,
        ...config,
      };
    });
  }

  protected getEnvFiles(): string[] {
    this.logger.debug('Reading environment variables from .env or .env.production files.');
    const envFiles = ['.env', '.env.production']
      .map(file => join(process.cwd(), file))
      .filter(file => existsSync(file));

    return envFiles;
  }

  protected parseEnvFile(filePath: string): string[] {
    this.logger.debug(`Parsing environment variables file: ${filePath}`);
    const content = readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .filter(line => line.includes('=')); // Only include valid KEY=value pairs
  }

  writeFiles({ dir }: { dir: string }): void {
    this.logger.debug(`Writing files to ${dir}`);
  }

  writeIndex({ dir }: { dir: string }): void {
    this.logger.debug(`Writing index file to ${dir}`);
  }

  async deploy({ dir, siteId }: { token: string; dir: string; siteId?: string }) {
    this.logger.debug(
      `Deploying with command ${this.scope}...${siteId || ''} to ${dir} ${this.projectName || 'mastra-starter'}`,
    );
  }
}
