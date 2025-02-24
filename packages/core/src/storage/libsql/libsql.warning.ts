import { MastraStorageLibSql as BaseMastraStorageLibSql } from './libsql';
import type { LibSQLConfig } from './libsql';

export * from './libsql';

export class MastraStorageLibSql extends BaseMastraStorageLibSql {
  constructor(args: { config: LibSQLConfig }) {
    super(args);

    this.logger.warn('Please import "MastraStorageLibSql" from "@mastra/core/storage" instead of "@mastra/core"');
  }
}
