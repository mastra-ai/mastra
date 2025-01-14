import { SyncAction } from '../sync';
import { ToolAction } from '../tools';
import { Workflow } from '../workflows';

export class Integration<ToolsParams = void, ApiClient = void> {
  name: string = 'Integration';
  private syncFunctions: Map<string, SyncAction<any, any, any, any>>;
  private workflows: Record<string, Workflow>;

  constructor() {
    this.syncFunctions = new Map();
    this.workflows = {};
  }

  /**
   * Workflows
   */

  registerWorkflow(name: string, fn: Workflow) {
    if (this.workflows[name]) {
      throw new Error(`Sync function "${name}" already registered`);
    }
    this.workflows[name] = fn;
  }

  public getWorkflows({ serialized }: { serialized?: boolean }): Record<string, Workflow> {
    if (serialized) {
      return Object.entries(this.workflows).reduce((acc, [k, v]) => {
        return {
          ...acc,
          [k]: {
            name: v.name,
          },
        };
      }, {});
    }
    return this.workflows;
  }

  /**
   * SYNCS
   */

  registerSync(fn: SyncAction<any, any, any, any>) {
    if (this.syncFunctions.has(fn.id)) {
      throw new Error(`Sync function "${fn.id}" already registered`);
    }
    this.syncFunctions.set(fn.id, fn);
  }

  getSyncs(): Record<string, SyncAction<any, any, any, any>> {
    return Array.from(this.syncFunctions.entries()).reduce((acc, [k, v]) => {
      return {
        ...acc,
        [k]: v,
      };
    }, {});
  }

  /**
   * TOOLS
   */
  getStaticTools(_params?: ToolsParams): Record<string, ToolAction<any, any, any, any>> {
    throw new Error('Method not implemented.');
  }

  async getTools(_params?: ToolsParams): Promise<Record<string, ToolAction<any, any, any, any>>> {
    throw new Error('Method not implemented.');
  }

  async getApiClient(): Promise<ApiClient> {
    throw new Error('Method not implemented');
  }
}
