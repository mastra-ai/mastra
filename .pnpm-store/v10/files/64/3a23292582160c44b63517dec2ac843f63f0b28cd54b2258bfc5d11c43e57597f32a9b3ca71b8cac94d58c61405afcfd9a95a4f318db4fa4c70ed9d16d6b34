"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobListResponsesSinglePage = exports.Jobs = void 0;
const resource_1 = require("../../../../resource.js");
const LogsAPI = __importStar(require("./logs.js"));
const logs_1 = require("./logs.js");
const pagination_1 = require("../../../../pagination.js");
class Jobs extends resource_1.APIResource {
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
exports.Jobs = Jobs;
class JobListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.JobListResponsesSinglePage = JobListResponsesSinglePage;
Jobs.JobListResponsesSinglePage = JobListResponsesSinglePage;
Jobs.Logs = logs_1.Logs;
Jobs.LogListResponsesSinglePage = logs_1.LogListResponsesSinglePage;
//# sourceMappingURL=jobs.js.map