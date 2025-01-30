import type { Agent } from '../agent';
import type { Logger } from '../logger';
import type { MastraTTS } from '../tts';
import type { MastraVector } from '../vector';
import type { Workflow } from '../workflows';

import type { MastraConfig } from './index';
import { Mastra as BaseMastra } from './index';

export class Mastra<
  TAgents extends Record<string, Agent<any>> = Record<string, Agent<any>>,
  TWorkflows extends Record<string, Workflow> = Record<string, Workflow>,
  TVectors extends Record<string, MastraVector> = Record<string, MastraVector>,
  TTTS extends Record<string, MastraTTS> = Record<string, MastraTTS>,
  TLogger extends Logger = Logger,
> extends BaseMastra<TAgents, TWorkflows, TVectors, TTTS, TLogger> {
  constructor(config?: MastraConfig<TAgents, TWorkflows, TVectors, TTTS, TLogger>) {
    super(config);

    this.logger.warn('Please import from "@mastra/core/mastra" instead of "@mastra/core"');
  }
}
