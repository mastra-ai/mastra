import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../pagination.js";
export declare class Submissions extends APIResource {
    /**
     * This endpoint returns information for submissions to made to reclassify emails.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const submissionListResponse of client.emailSecurity.submissions.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: SubmissionListParams, options?: Core.RequestOptions): Core.PagePromise<SubmissionListResponsesV4PagePaginationArray, SubmissionListResponse>;
}
export declare class SubmissionListResponsesV4PagePaginationArray extends V4PagePaginationArray<SubmissionListResponse> {
}
export interface SubmissionListResponse {
    requested_ts: string;
    submission_id: string;
    original_disposition?: 'MALICIOUS' | 'MALICIOUS-BEC' | 'SUSPICIOUS' | 'SPOOF' | 'SPAM' | 'BULK' | 'ENCRYPTED' | 'EXTERNAL' | 'UNKNOWN' | 'NONE' | null;
    original_edf_hash?: string | null;
    outcome?: string | null;
    outcome_disposition?: 'MALICIOUS' | 'MALICIOUS-BEC' | 'SUSPICIOUS' | 'SPOOF' | 'SPAM' | 'BULK' | 'ENCRYPTED' | 'EXTERNAL' | 'UNKNOWN' | 'NONE' | null;
    requested_by?: string | null;
    requested_disposition?: 'MALICIOUS' | 'MALICIOUS-BEC' | 'SUSPICIOUS' | 'SPOOF' | 'SPAM' | 'BULK' | 'ENCRYPTED' | 'EXTERNAL' | 'UNKNOWN' | 'NONE' | null;
    status?: string | null;
    subject?: string | null;
    type?: string | null;
}
export interface SubmissionListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Account Identifier
     */
    account_id: string;
    /**
     * Query param: The end of the search date range. Defaults to `now`.
     */
    end?: string;
    /**
     * Query param:
     */
    original_disposition?: 'MALICIOUS' | 'SUSPICIOUS' | 'SPOOF' | 'SPAM' | 'BULK' | 'NONE';
    /**
     * Query param:
     */
    outcome_disposition?: 'MALICIOUS' | 'SUSPICIOUS' | 'SPOOF' | 'SPAM' | 'BULK' | 'NONE';
    /**
     * Query param:
     */
    query?: string | null;
    /**
     * Query param:
     */
    requested_disposition?: 'MALICIOUS' | 'SUSPICIOUS' | 'SPOOF' | 'SPAM' | 'BULK' | 'NONE';
    /**
     * Query param: The beginning of the search date range. Defaults to
     * `now - 30 days`.
     */
    start?: string;
    /**
     * Query param:
     */
    submission_id?: string;
    /**
     * Query param:
     */
    type?: 'TEAM' | 'USER';
}
export declare namespace Submissions {
    export { type SubmissionListResponse as SubmissionListResponse, SubmissionListResponsesV4PagePaginationArray as SubmissionListResponsesV4PagePaginationArray, type SubmissionListParams as SubmissionListParams, };
}
//# sourceMappingURL=submissions.d.ts.map