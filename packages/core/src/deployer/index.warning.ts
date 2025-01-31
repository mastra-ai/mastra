import { MastraDeployer as BaseDeployer } from './index';

export class MastraDeployer extends BaseDeployer {
  constructor(args: { projectName: string; scope: string; env?: Record<string, any> }) {
    super(args);

    this.logger.warn('Please import "MastraDeployer" from "@mastra/core/agent" instead of "@mastra/core"');
  }
}
