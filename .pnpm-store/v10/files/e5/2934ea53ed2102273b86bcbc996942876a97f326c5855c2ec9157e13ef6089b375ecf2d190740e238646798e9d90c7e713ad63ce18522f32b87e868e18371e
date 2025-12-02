import type { ToolAction } from '../tools/index.js';
import type { Workflow } from '../workflows/index.js';
export declare class Integration<ToolsParams = void, ApiClient = void> {
    name: string;
    private workflows;
    constructor();
    /**
     * Workflows
     */
    registerWorkflow(name: string, fn: Workflow): void;
    listWorkflows({ serialized }: {
        serialized?: boolean;
    }): Record<string, Workflow>;
    /**
     * TOOLS
     */
    listStaticTools(_params?: ToolsParams): Record<string, ToolAction<any, any, any>>;
    listTools(_params?: ToolsParams): Promise<Record<string, ToolAction<any, any, any>>>;
    getApiClient(): Promise<ApiClient>;
}
//# sourceMappingURL=integration.d.ts.map