import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as IssuesAPI from "../../intel/attack-surface-report/issues.js";
export declare class Type extends APIResource {
    /**
     * Get Security Center Insight Counts by Type
     */
    get(params?: TypeGetParams, options?: Core.RequestOptions): Core.APIPromise<TypeGetResponse>;
    get(options?: Core.RequestOptions): Core.APIPromise<TypeGetResponse>;
}
export type TypeGetResponse = Array<TypeGetResponse.TypeGetResponseItem>;
export declare namespace TypeGetResponse {
    interface TypeGetResponseItem {
        count?: number;
        value?: string;
    }
}
export interface TypeGetParams {
    /**
     * Path param: The Account ID to use for this endpoint. Mutually exclusive with the
     * Zone ID.
     */
    account_id?: string;
    /**
     * Path param: The Zone ID to use for this endpoint. Mutually exclusive with the
     * Account ID.
     */
    zone_id?: string;
    /**
     * Query param:
     */
    dismissed?: boolean;
    /**
     * Query param:
     */
    issue_class?: Array<string>;
    /**
     * Query param:
     */
    'issue_class~neq'?: Array<string>;
    /**
     * Query param:
     */
    issue_type?: Array<IssuesAPI.IssueTypeParam>;
    /**
     * Query param:
     */
    'issue_type~neq'?: Array<IssuesAPI.IssueTypeParam>;
    /**
     * Query param:
     */
    product?: Array<string>;
    /**
     * Query param:
     */
    'product~neq'?: Array<string>;
    /**
     * Query param:
     */
    severity?: Array<IssuesAPI.SeverityQueryParamParam>;
    /**
     * Query param:
     */
    'severity~neq'?: Array<IssuesAPI.SeverityQueryParamParam>;
    /**
     * Query param:
     */
    subject?: Array<string>;
    /**
     * Query param:
     */
    'subject~neq'?: Array<string>;
}
export declare namespace Type {
    export { type TypeGetResponse as TypeGetResponse, type TypeGetParams as TypeGetParams };
}
//# sourceMappingURL=type.d.ts.map