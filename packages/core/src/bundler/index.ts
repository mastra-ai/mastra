import { loadEnvVars } from '@internal/deployer';
import type { IBundler } from '@internal/deployer';

import { MastraBase } from '../base';

export type { BundlerConfig, IBundler } from '@internal/deployer';

export abstract class MastraBundler extends MastraBase implements IBundler {
  constructor({ name, component = 'BUNDLER' }: { name: string; component?: 'BUNDLER' | 'DEPLOYER' }) {
    super({ component, name });
  }

  async loadEnvVars(): Promise<Map<string, string>> {
    return loadEnvVars(await this.getEnvFiles());
  }

  abstract getAllToolPaths(mastraDir: string, toolsPaths: (string | string[])[]): (string | string[])[];
  abstract prepare(outputDirectory: string): Promise<void>;
  abstract writePackageJson(outputDirectory: string, dependencies: Map<string, string>): Promise<void>;
  abstract getEnvFiles(): Promise<string[]>;
  abstract bundle(
    entryFile: string,
    outputDirectory: string,
    { toolsPaths, projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void>;
  abstract lint(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void>;
}
