import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class IssueTypes extends APIResource {
    /**
     * Get Security Center Issues Types
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const issueTypeGetResponse of client.intel.attackSurfaceReport.issueTypes.get(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(params: IssueTypeGetParams, options?: Core.RequestOptions): Core.PagePromise<IssueTypeGetResponsesSinglePage, IssueTypeGetResponse>;
}
export declare class IssueTypeGetResponsesSinglePage extends SinglePage<IssueTypeGetResponse> {
}
export type IssueTypeGetResponse = string;
export interface IssueTypeGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace IssueTypes {
    export { type IssueTypeGetResponse as IssueTypeGetResponse, IssueTypeGetResponsesSinglePage as IssueTypeGetResponsesSinglePage, type IssueTypeGetParams as IssueTypeGetParams, };
}
//# sourceMappingURL=issue-types.d.ts.map