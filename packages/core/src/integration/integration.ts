import { Action } from '../action';
import { ToolApi } from '../tools/types';
import { Workflow } from '../workflows';

export class Integration<ToolsParams = void, ApiClient = void> {
  name: string = 'Integration';
  private syncFunctions: Map<string, Action<any, any>>;
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

  getWorkflows() {
    return this.workflows;
  }

  /**
   * SYNCS
   */

  registerSync(name: string, fn: Action<any, any>) {
    if (this.syncFunctions.has(name)) {
      throw new Error(`Sync function "${name}" already registered`);
    }
    this.syncFunctions.set(name, fn);
  }

  getSyncs(): Record<string, Action<any, any>> {
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

  async getApiClient(): Promise<ApiClient> {
    throw new Error('Method not implemented');
  }
}