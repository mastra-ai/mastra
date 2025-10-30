import type { ToolAction } from '../tools';
import type { Workflow } from '../workflows';

export class Integration<ToolsParams = void, ApiClient = void> {
  name: string = 'Integration';
  private workflows: Record<string, Workflow>;

  constructor() {
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

  public listWorkflows({ serialized }: { serialized?: boolean }): Record<string, Workflow> {
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
   * TOOLS
   */
  listStaticTools(_params?: ToolsParams): Record<string, ToolAction<any, any, any>> {
    throw new Error('Method not implemented.');
  }

  async listTools(_params?: ToolsParams): Promise<Record<string, ToolAction<any, any, any>>> {
    throw new Error('Method not implemented.');
  }

  async getApiClient(): Promise<ApiClient> {
    throw new Error('Method not implemented');
  }
}
