import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as IssuesAPI from "../../intel/attack-surface-report/issues.js";
import * as ClassAPI from "./class.js";
import { Class, ClassGetParams, ClassGetResponse } from "./class.js";
import * as SeverityAPI from "./severity.js";
import { Severity, SeverityGetParams, SeverityGetResponse } from "./severity.js";
import * as TypeAPI from "./type.js";
import { Type, TypeGetParams, TypeGetResponse } from "./type.js";
import { V4PagePagination, type V4PagePaginationParams } from "../../../pagination.js";
export declare class Insights extends APIResource {
    class: ClassAPI.Class;
    severity: SeverityAPI.Severity;
    type: TypeAPI.Type;
    /**
     * Get Security Center Insights
     */
    list(params?: InsightListParams, options?: Core.RequestOptions): Core.PagePromise<InsightListResponsesV4PagePagination, InsightListResponse>;
    list(options?: Core.RequestOptions): Core.PagePromise<InsightListResponsesV4PagePagination, InsightListResponse>;
    /**
     * Archive Security Center Insight
     */
    dismiss(issueId: string, params: InsightDismissParams, options?: Core.RequestOptions): Core.APIPromise<InsightDismissResponse>;
}
export declare class InsightListResponsesV4PagePagination extends V4PagePagination<InsightListResponse> {
}
export interface InsightListResponse {
    /**
     * Total number of results
     */
    count?: number;
    issues?: Array<InsightListResponse.Issue>;
    /**
     * Current page within paginated list of results
     */
    page?: number;
    /**
     * Number of results per page of results
     */
    per_page?: number;
}
export declare namespace InsightListResponse {
    interface Issue {
        id?: string;
        dismissed?: boolean;
        issue_class?: string;
        issue_type?: IssuesAPI.IssueType;
        payload?: unknown;
        resolve_link?: string;
        resolve_text?: string;
        severity?: 'Low' | 'Moderate' | 'Critical';
        since?: string;
        subject?: string;
        timestamp?: string;
    }
}
export interface InsightDismissResponse {
    errors: Array<InsightDismissResponse.Error>;
    messages: Array<InsightDismissResponse.Message>;
    /**
     * Whether the API call was successful.
     */
    success: true;
}
export declare namespace InsightDismissResponse {
    interface Error {
        code: number;
        message: string;
        documentation_url?: string;
        source?: Error.Source;
    }
    namespace Error {
        interface Source {
            pointer?: string;
        }
    }
    interface Message {
        code: number;
        message: string;
        documentation_url?: string;
        source?: Message.Source;
    }
    namespace Message {
        interface Source {
            pointer?: string;
        }
    }
}
export interface InsightListParams extends V4PagePaginationParams {
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
export interface InsightDismissParams {
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
     * Body param:
     */
    dismiss?: boolean;
}
export declare namespace Insights {
    export { type InsightListResponse as InsightListResponse, type InsightDismissResponse as InsightDismissResponse, InsightListResponsesV4PagePagination as InsightListResponsesV4PagePagination, type InsightListParams as InsightListParams, type InsightDismissParams as InsightDismissParams, };
    export { Class as Class, type ClassGetResponse as ClassGetResponse, type ClassGetParams as ClassGetParams };
    export { Severity as Severity, type SeverityGetResponse as SeverityGetResponse, type SeverityGetParams as SeverityGetParams, };
    export { Type as Type, type TypeGetResponse as TypeGetResponse, type TypeGetParams as TypeGetParams };
}
//# sourceMappingURL=insights.d.ts.map