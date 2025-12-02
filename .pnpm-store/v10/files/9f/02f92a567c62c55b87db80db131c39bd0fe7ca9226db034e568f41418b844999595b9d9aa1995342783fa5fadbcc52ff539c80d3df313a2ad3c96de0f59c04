import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as IssuesAPI from "../../intel/attack-surface-report/issues.js";
export declare class Class extends APIResource {
    /**
     * Get Security Center Insight Counts by Class
     */
    get(params?: ClassGetParams, options?: Core.RequestOptions): Core.APIPromise<ClassGetResponse>;
    get(options?: Core.RequestOptions): Core.APIPromise<ClassGetResponse>;
}
export type ClassGetResponse = Array<ClassGetResponse.ClassGetResponseItem>;
export declare namespace ClassGetResponse {
    interface ClassGetResponseItem {
        count?: number;
        value?: string;
    }
}
export interface ClassGetParams {
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
export declare namespace Class {
    export { type ClassGetResponse as ClassGetResponse, type ClassGetParams as ClassGetParams };
}
//# sourceMappingURL=class.d.ts.map