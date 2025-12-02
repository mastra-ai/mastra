import { APIResource } from "../../../../../resource.js";
import * as Core from "../../../../../core.js";
export declare class Logs extends APIResource {
    /**
     * Fetch deployment logs for a project.
     *
     * @example
     * ```ts
     * const log =
     *   await client.pages.projects.deployments.history.logs.get(
     *     'this-is-my-project-01',
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(projectName: string, deploymentId: string, params: LogGetParams, options?: Core.RequestOptions): Core.APIPromise<LogGetResponse>;
}
export interface LogGetResponse {
    data?: Array<LogGetResponse.Data>;
    includes_container_logs?: boolean;
    total?: number;
}
export declare namespace LogGetResponse {
    interface Data {
        line?: string;
        ts?: string;
    }
}
export interface LogGetParams {
    /**
     * Identifier
     */
    account_id: string;
}
export declare namespace Logs {
    export { type LogGetResponse as LogGetResponse, type LogGetParams as LogGetParams };
}
//# sourceMappingURL=logs.d.ts.map