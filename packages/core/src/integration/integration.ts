import { syncApi } from '../sync/types';
import { ToolApi } from '../tools/types';
import { Workflow } from '../workflows';

export class MIntegration<ToolsParams = void> {
  private syncFunctions: Map<string, syncApi<any, any>>;
  private workflows: Map<string, Workflow>;

  constructor() {
    this.syncFunctions = new Map();
    this.workflows = new Map();
  }

  /**
   * Workflows
   */

  registerWorkflow(name: string, fn: Workflow) {
    if (this.workflows.has(name)) {
      throw new Error(`Sync function "${name}" already registered`);
    }
    this.workflows.set(name, fn);
  }

  getWorkflows() {
    return Array.from(this.workflows.entries()).map(([_, v]) => v);
  }

  /**
   * SYNCS
   */

  registerSync(name: string, fn: syncApi<any, any>) {
    if (this.syncFunctions.has(name)) {
      throw new Error(`Sync function "${name}" already registered`);
    }
    this.syncFunctions.set(name, fn);
  }

  getSyncs(): Record<string, syncApi<any, any>> {
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
  getStaticTools(_params?: ToolsParams): Record<string, ToolApi> {
    throw new Error('Method not implemented.');
  }

  async getTools(_params?: ToolsParams): Promise<Record<string, ToolApi>> {
    throw new Error('Method not implemented.');
  }
}
