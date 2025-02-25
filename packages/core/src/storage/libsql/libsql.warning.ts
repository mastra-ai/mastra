import { LibSQLStore as BaseLibSQLStore } from './libsql';
import type { LibSQLConfig } from './libsql';

export * from './libsql';

export class LibSQLStore extends BaseLibSQLStore {
  constructor(args: { config: LibSQLConfig }) {
    super(args);

    this.logger.warn('Please import "LibSQLStore" from "@mastra/core/storage" instead of "@mastra/core"');
  }
}
