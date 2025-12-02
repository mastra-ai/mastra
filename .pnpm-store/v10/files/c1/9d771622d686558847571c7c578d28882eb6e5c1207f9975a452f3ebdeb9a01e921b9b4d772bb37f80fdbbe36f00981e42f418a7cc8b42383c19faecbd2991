import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import { SinglePage } from "../../../../pagination.js";
export declare class Logs extends APIResource {
    /**
     * Get job logs
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const logListResponse of client.r2.superSlurper.jobs.logs.list(
     *   'job_id',
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(jobId: string, params: LogListParams, options?: Core.RequestOptions): Core.PagePromise<LogListResponsesSinglePage, LogListResponse>;
}
export declare class LogListResponsesSinglePage extends SinglePage<LogListResponse> {
}
export interface LogListResponse {
    createdAt?: string;
    job?: string;
    logType?: 'migrationStart' | 'migrationComplete' | 'migrationAbort' | 'migrationError' | 'migrationPause' | 'migrationResume' | 'migrationErrorFailedContinuation' | 'importErrorRetryExhaustion' | 'importSkippedStorageClass' | 'importSkippedOversized' | 'importSkippedEmptyObject' | 'importSkippedUnsupportedContentType' | 'importSkippedExcludedContentType' | 'importSkippedInvalidMedia' | 'importSkippedRequiresRetrieval';
    message?: string | null;
    objectKey?: string | null;
}
export interface LogListParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Query param:
     */
    limit?: number;
    /**
     * Query param:
     */
    offset?: number;
}
export declare namespace Logs {
    export { type LogListResponse as LogListResponse, LogListResponsesSinglePage as LogListResponsesSinglePage, type LogListParams as LogListParams, };
}
//# sourceMappingURL=logs.d.ts.map