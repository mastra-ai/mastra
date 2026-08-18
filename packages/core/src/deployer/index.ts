import { MastraBundler } from '../bundler';
import type { IBundler } from '../bundler';

export interface IDeployer extends IBundler {
  deploy(outputDirectory: string): Promise<void>;
  /**
   * When true, `mastra build` runs `deploy()` right after bundling.
   * Push-style deployers (e.g. sandbox deploys) opt in; platform deployers
   * that deploy via their own tooling (git push, wrangler, ...) leave it unset.
   */
  readonly deployOnBuild?: boolean;
}

export abstract class MastraDeployer extends MastraBundler implements IDeployer {
  constructor({ name }: { name: string }) {
    super({ component: 'DEPLOYER', name });
  }

  abstract deploy(outputDirectory: string): Promise<void>;

  /** See {@link IDeployer.deployOnBuild}. */
  readonly deployOnBuild?: boolean;
}
