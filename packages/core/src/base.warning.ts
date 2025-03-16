import { MastraBase as MastraBaseBase } from './base';
import type { BaseLogger } from './logger/base-logger';
import type { RegisteredLogger, LogLevel } from './logger/types';

export class MastraBase extends MastraBaseBase {
  constructor(args: {
    component?: RegisteredLogger;
    name?: string;
    createLogger?: (options: { name?: string; level?: LogLevel }) => BaseLogger;
  }) {
    super(args);

    this.logger.warn('Please import "MastraBase" from "@mastra/core/base" instead of "@mastra/core"');
  }
}
