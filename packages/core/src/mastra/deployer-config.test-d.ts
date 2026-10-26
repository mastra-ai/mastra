import { describe, expectTypeOf, it } from 'vitest';
import type { MastraDeployer, IDeployer } from '../deployer';
import type { IMastraLogger } from '../logger';
import type { Config, Mastra } from './index';

/**
 * Stand-in for a deployer whose base class is a separately bundled copy of
 * `MastraBase` (as in `@mastra/deployer`): it carries its own `#private`
 * field, so it can never be nominally assignable to `MastraDeployer`.
 */
class StructuralDeployer implements IDeployer {
  #logger?: IMastraLogger;
  __setLogger(logger: IMastraLogger) {
    this.#logger = logger;
  }
  async loadEnvVars() {
    return new Map<string, string>();
  }
  async getEnvFiles() {
    return [];
  }
  getAllToolPaths() {
    return [];
  }
  async bundle() {}
  async prepare() {}
  async writePackageJson() {}
  async lint() {}
  async deploy() {}
}

describe('Mastra deployer config', () => {
  it('accepts a deployer that implements IDeployer without extending MastraDeployer', () => {
    expectTypeOf<StructuralDeployer>().not.toExtend<MastraDeployer>();
    expectTypeOf<StructuralDeployer>().toExtend<NonNullable<Config['deployer']>>();
  });

  it('still accepts MastraDeployer subclasses', () => {
    expectTypeOf<MastraDeployer>().toExtend<NonNullable<Config['deployer']>>();
  });

  it('returns the IDeployer contract from getDeployer()', () => {
    expectTypeOf<ReturnType<Mastra['getDeployer']>>().toEqualTypeOf<IDeployer | undefined>();
  });
});
