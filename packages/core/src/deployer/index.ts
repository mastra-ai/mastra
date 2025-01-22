import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export abstract class MastraDeployer {
  scope: string;
  projectName: string;
  env?: Record<string, any>;

  constructor({ scope, env, projectName }: { projectName: string; scope: string; env?: Record<string, any> }) {
    this.scope = scope;
    this.env = env;
    this.projectName = projectName;
  }

  protected getEnvFiles(): string[] {
    const envFiles = ['.env', '.env.development', '.env.local']
      .map(file => join(process.cwd(), file))
      .filter(file => existsSync(file));
    return envFiles;
  }

  protected parseEnvFile(filePath: string): string[] {
    const content = readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .filter(line => line.includes('=')); // Only include valid KEY=value pairs
  }

  writeFiles({ dir }: { dir: string }): void {
    console.log('Writing files to', dir);
  }

  writeIndex({ dir }: { dir: string }): void {
    console.log('Writing index to', dir);
  }

  async deploy({ dir, siteId }: { token: string; dir: string; siteId?: string }) {
    console.log(`Deploy command ${this.scope}...${siteId || ''} to ${dir} ${this.projectName || 'mastra-starter'}`);
  }
}
