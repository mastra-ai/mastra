import type { IDeployer } from '@internal/deployer';

import { MastraBundler } from '../bundler';

export type { IDeployer } from '@internal/deployer';

export abstract class MastraDeployer extends MastraBundler implements IDeployer {
  constructor({ name }: { name: string }) {
    super({ component: 'DEPLOYER', name });
  }

  abstract deploy(outputDirectory: string): Promise<void>;

  /** See {@link IDeployer.deployOnBuild}. */
  readonly deployOnBuild?: boolean;
}
