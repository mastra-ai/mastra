import type { ToolAction } from '../tools/index.js';
export declare abstract class OpenAPIToolset {
    abstract readonly name: string;
    abstract readonly tools: Record<string, ToolAction<any, any, any>>;
    authType: string;
    constructor();
    protected get toolSchemas(): any;
    protected get toolDocumentations(): Record<string, {
        comment: string;
        doc?: string;
    }>;
    protected get baseClient(): any;
    getApiClient(): Promise<any>;
    protected _generateIntegrationTools<T>(): T;
}
//# sourceMappingURL=openapi-toolset.d.ts.map