import { MastraBundler } from '../bundler';

export abstract class MastraDeployer extends MastraBundler {
  constructor({ name }: { name: string }) {
    super({ component: 'DEPLOYER', name });
  }

  abstract deploy(outputDirectory: string): Promise<void>;
}
