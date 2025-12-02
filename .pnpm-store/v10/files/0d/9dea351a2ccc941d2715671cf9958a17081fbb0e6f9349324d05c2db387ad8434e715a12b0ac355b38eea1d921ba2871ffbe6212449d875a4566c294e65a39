// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as LogsAPI from "./logs.mjs";
import { LogListResponsesSinglePage, Logs } from "./logs.mjs";
import { SinglePage } from "../../../../pagination.mjs";
export class Jobs extends APIResource {
    constructor() {
        super(...arguments);
        this.logs = new LogsAPI.Logs(this._client);
    }
    /**
     * Create a job
     *
     * @example
     * ```ts
     * const job = await client.r2.superSlurper.jobs.create({
     *   account_id: 'account_id',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/slurper/jobs`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List jobs
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const jobListResponse of client.r2.superSlurper.jobs.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/slurper/jobs`, JobListResponsesSinglePage, {
            query,
            ...options,
        });
    }
    /**
     * Abort a job
     *
     * @example
     * ```ts
     * const response = await client.r2.superSlurper.jobs.abort(
     *   'job_id',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    abort(jobId, params, options) {
        const { account_id } = params;
        return this._client.put(`/accounts/${account_id}/slurper/jobs/${jobId}/abort`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Abort all jobs
     *
     * @example
     * ```ts
     * const response = await client.r2.superSlurper.jobs.abortAll(
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    abortAll(params, options) {
        const { account_id } = params;
        return this._client.put(`/accounts/${account_id}/slurper/jobs/abortAll`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get job details
     *
     * @example
     * ```ts
     * const job = await client.r2.superSlurper.jobs.get(
     *   'job_id',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(jobId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/slurper/jobs/${jobId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Pause a job
     *
     * @example
     * ```ts
     * const response = await client.r2.superSlurper.jobs.pause(
     *   'job_id',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    pause(jobId, params, options) {
        const { account_id } = params;
        return this._client.put(`/accounts/${account_id}/slurper/jobs/${jobId}/pause`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get job progress
     *
     * @example
     * ```ts
     * const response = await client.r2.superSlurper.jobs.progress(
     *   'job_id',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    progress(jobId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/slurper/jobs/${jobId}/progress`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Resume a job
     *
     * @example
     * ```ts
     * const response = await client.r2.superSlurper.jobs.resume(
     *   'job_id',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    resume(jobId, params, options) {
        const { account_id } = params;
        return this._client.put(`/accounts/${account_id}/slurper/jobs/${jobId}/resume`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class JobListResponsesSinglePage extends SinglePage {
}
Jobs.JobListResponsesSinglePage = JobListResponsesSinglePage;
Jobs.Logs = Logs;
Jobs.LogListResponsesSinglePage = LogListResponsesSinglePage;
//# sourceMappingURL=jobs.mjs.map