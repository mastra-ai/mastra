import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as SippyAPI from "../../buckets/sippy.js";
import * as LogsAPI from "./logs.js";
import { LogListParams, LogListResponse, LogListResponsesSinglePage, Logs } from "./logs.js";
import { SinglePage } from "../../../../pagination.js";
export declare class Jobs extends APIResource {
    logs: LogsAPI.Logs;
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
    create(params: JobCreateParams, options?: Core.RequestOptions): Core.APIPromise<JobCreateResponse>;
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
    list(params: JobListParams, options?: Core.RequestOptions): Core.PagePromise<JobListResponsesSinglePage, JobListResponse>;
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
    abort(jobId: string, params: JobAbortParams, options?: Core.RequestOptions): Core.APIPromise<JobAbortResponse>;
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
    abortAll(params: JobAbortAllParams, options?: Core.RequestOptions): Core.APIPromise<JobAbortAllResponse>;
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
    get(jobId: string, params: JobGetParams, options?: Core.RequestOptions): Core.APIPromise<JobGetResponse>;
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
    pause(jobId: string, params: JobPauseParams, options?: Core.RequestOptions): Core.APIPromise<JobPauseResponse>;
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
    progress(jobId: string, params: JobProgressParams, options?: Core.RequestOptions): Core.APIPromise<JobProgressResponse>;
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
    resume(jobId: string, params: JobResumeParams, options?: Core.RequestOptions): Core.APIPromise<JobResumeResponse>;
}
export declare class JobListResponsesSinglePage extends SinglePage<JobListResponse> {
}
export interface JobCreateResponse {
    id?: string;
}
export interface JobListResponse {
    id?: string;
    createdAt?: string;
    finishedAt?: string | null;
    overwrite?: boolean;
    source?: JobListResponse.S3SourceResponseSchema | JobListResponse.GcsSourceResponseSchema | JobListResponse.R2SourceResponseSchema;
    status?: 'running' | 'paused' | 'aborted' | 'completed';
    target?: JobListResponse.Target;
}
export declare namespace JobListResponse {
    interface S3SourceResponseSchema {
        bucket?: string;
        endpoint?: string | null;
        pathPrefix?: string | null;
        vendor?: 's3';
    }
    interface GcsSourceResponseSchema {
        bucket?: string;
        pathPrefix?: string | null;
        vendor?: 'gcs';
    }
    interface R2SourceResponseSchema {
        bucket?: string;
        jurisdiction?: 'default' | 'eu' | 'fedramp';
        pathPrefix?: string | null;
        vendor?: SippyAPI.Provider;
    }
    interface Target {
        bucket?: string;
        jurisdiction?: 'default' | 'eu' | 'fedramp';
        vendor?: SippyAPI.Provider;
    }
}
export type JobAbortResponse = string;
export type JobAbortAllResponse = string;
export interface JobGetResponse {
    id?: string;
    createdAt?: string;
    finishedAt?: string | null;
    overwrite?: boolean;
    source?: JobGetResponse.S3SourceResponseSchema | JobGetResponse.GcsSourceResponseSchema | JobGetResponse.R2SourceResponseSchema;
    status?: 'running' | 'paused' | 'aborted' | 'completed';
    target?: JobGetResponse.Target;
}
export declare namespace JobGetResponse {
    interface S3SourceResponseSchema {
        bucket?: string;
        endpoint?: string | null;
        pathPrefix?: string | null;
        vendor?: 's3';
    }
    interface GcsSourceResponseSchema {
        bucket?: string;
        pathPrefix?: string | null;
        vendor?: 'gcs';
    }
    interface R2SourceResponseSchema {
        bucket?: string;
        jurisdiction?: 'default' | 'eu' | 'fedramp';
        pathPrefix?: string | null;
        vendor?: SippyAPI.Provider;
    }
    interface Target {
        bucket?: string;
        jurisdiction?: 'default' | 'eu' | 'fedramp';
        vendor?: SippyAPI.Provider;
    }
}
export type JobPauseResponse = string;
export interface JobProgressResponse {
    id?: string;
    createdAt?: string;
    failedObjects?: number;
    objects?: number;
    skippedObjects?: number;
    status?: 'running' | 'paused' | 'aborted' | 'completed';
    transferredObjects?: number;
}
export type JobResumeResponse = string;
export interface JobCreateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    overwrite?: boolean;
    /**
     * Body param:
     */
    source?: JobCreateParams.R2SlurperS3SourceSchema | JobCreateParams.R2SlurperGcsSourceSchema | JobCreateParams.R2SlurperR2SourceSchema;
    /**
     * Body param:
     */
    target?: JobCreateParams.Target;
}
export declare namespace JobCreateParams {
    interface R2SlurperS3SourceSchema {
        bucket?: string;
        endpoint?: string | null;
        secret?: R2SlurperS3SourceSchema.Secret;
        vendor?: 's3';
    }
    namespace R2SlurperS3SourceSchema {
        interface Secret {
            accessKeyId?: string;
            secretAccessKey?: string;
        }
    }
    interface R2SlurperGcsSourceSchema {
        bucket?: string;
        secret?: R2SlurperGcsSourceSchema.Secret;
        vendor?: 'gcs';
    }
    namespace R2SlurperGcsSourceSchema {
        interface Secret {
            clientEmail?: string;
            privateKey?: string;
        }
    }
    interface R2SlurperR2SourceSchema {
        bucket?: string;
        jurisdiction?: 'default' | 'eu' | 'fedramp';
        secret?: R2SlurperR2SourceSchema.Secret;
        vendor?: SippyAPI.ProviderParam;
    }
    namespace R2SlurperR2SourceSchema {
        interface Secret {
            accessKeyId?: string;
            secretAccessKey?: string;
        }
    }
    interface Target {
        bucket?: string;
        jurisdiction?: 'default' | 'eu' | 'fedramp';
        secret?: Target.Secret;
        vendor?: SippyAPI.ProviderParam;
    }
    namespace Target {
        interface Secret {
            accessKeyId?: string;
            secretAccessKey?: string;
        }
    }
}
export interface JobListParams {
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
export interface JobAbortParams {
    account_id: string;
}
export interface JobAbortAllParams {
    account_id: string;
}
export interface JobGetParams {
    account_id: string;
}
export interface JobPauseParams {
    account_id: string;
}
export interface JobProgressParams {
    account_id: string;
}
export interface JobResumeParams {
    account_id: string;
}
export declare namespace Jobs {
    export { type JobCreateResponse as JobCreateResponse, type JobListResponse as JobListResponse, type JobAbortResponse as JobAbortResponse, type JobAbortAllResponse as JobAbortAllResponse, type JobGetResponse as JobGetResponse, type JobPauseResponse as JobPauseResponse, type JobProgressResponse as JobProgressResponse, type JobResumeResponse as JobResumeResponse, JobListResponsesSinglePage as JobListResponsesSinglePage, type JobCreateParams as JobCreateParams, type JobListParams as JobListParams, type JobAbortParams as JobAbortParams, type JobAbortAllParams as JobAbortAllParams, type JobGetParams as JobGetParams, type JobPauseParams as JobPauseParams, type JobProgressParams as JobProgressParams, type JobResumeParams as JobResumeParams, };
    export { Logs as Logs, type LogListResponse as LogListResponse, LogListResponsesSinglePage as LogListResponsesSinglePage, type LogListParams as LogListParams, };
}
//# sourceMappingURL=jobs.d.ts.map