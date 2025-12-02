// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { SinglePage } from "../../../../pagination.mjs";
export class Logs extends APIResource {
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
    list(jobId, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/slurper/jobs/${jobId}/logs`, LogListResponsesSinglePage, { query, ...options });
    }
}
export class LogListResponsesSinglePage extends SinglePage {
}
Logs.LogListResponsesSinglePage = LogListResponsesSinglePage;
//# sourceMappingURL=logs.mjs.map