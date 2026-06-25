import { ACPConnection } from './connection';
import type { CreateACPToolOptions } from './types';

export class ACPToolSession {
  private connection?: ACPConnection;

  constructor(private readonly options: CreateACPToolOptions) {}

  getConnection(workspace: CreateACPToolOptions['workspace']): ACPConnection {
    if (this.options.persistSession === false) {
      return this.createConnection(workspace);
    }

    this.connection ??= this.createConnection(workspace);
    return this.connection;
  }

  private createConnection(workspace: CreateACPToolOptions['workspace']): ACPConnection {
    return new ACPConnection({
      ...this.options,
      workspace: workspace ?? this.options.workspace,
    });
  }
}
