import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class WorkflowResource extends APIResource {
    /**
     * Gets Zaraz workflow for a zone.
     *
     * @example
     * ```ts
     * const workflow = await client.zaraz.workflow.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: WorkflowGetParams, options?: Core.RequestOptions): Core.APIPromise<Workflow>;
}
/**
 * Zaraz workflow
 */
export type Workflow = 'realtime' | 'preview';
/**
 * Zaraz workflow
 */
export type WorkflowParam = 'realtime' | 'preview';
export interface WorkflowGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace WorkflowResource {
    export { type Workflow as Workflow, type WorkflowGetParams as WorkflowGetParams };
}
//# sourceMappingURL=workflow.d.ts.map