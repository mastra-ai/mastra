import { execa } from 'execa';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { bundle } from '../../utils/bundle.js';
import getPackageManager from '../../utils/getPackageManager.js';

export abstract class Deployer {
  token: string;
  dotMastraPath: string;
  name: string = '';

  constructor({ token }: { token: string }) {
    console.log('Deployer created');
    this.token = token;
    this.dotMastraPath = join(process.cwd(), '.mastra');
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

  async installCli() {
    console.log('Installing...');
  }

  async install() {
    const i = execa(getPackageManager(), ['install'], {
      cwd: this.dotMastraPath,
    });
    i.stdout.pipe(process.stdout);
    await i;
  }

  async build() {
    if (!existsSync(this.dotMastraPath)) {
      mkdirSync(this.dotMastraPath);
    }

    await bundle();
  }

  writePkgJson() {
    console.log('Writing package.json...');
  }

  writeFiles() {
    console.log('Writing files...');
  }

  async deployCommand({ scope }: { scope: string }) {
    console.log(`Deploy command ${scope}...`);
  }

  async deploy({ scope }: { scope: string }) {
    await this.installCli();
    this.writePkgJson();
    this.writeFiles();
    await this.install();
    await this.build();
    await this.deployCommand({ scope });
  }
}
