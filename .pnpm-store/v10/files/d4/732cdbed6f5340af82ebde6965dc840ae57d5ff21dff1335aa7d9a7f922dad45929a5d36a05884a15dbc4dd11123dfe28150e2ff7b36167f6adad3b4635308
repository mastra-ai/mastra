import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class Rules extends APIResource {
    /**
     * Put Rules
     */
    update(params: RuleUpdateParams, options?: Core.RequestOptions): Core.PagePromise<RuleUpdateResponsesSinglePage, RuleUpdateResponse>;
    /**
     * Rules
     */
    list(params: RuleListParams, options?: Core.RequestOptions): Core.PagePromise<RuleListResponsesSinglePage, RuleListResponse>;
}
export declare class RuleUpdateResponsesSinglePage extends SinglePage<RuleUpdateResponse> {
}
export declare class RuleListResponsesSinglePage extends SinglePage<RuleListResponse> {
}
export interface RuleUpdateResponse {
    id?: string;
    description?: string;
    enabled?: boolean;
    expression?: string;
    /**
     * Parameters of Cloud Connector Rule
     */
    parameters?: RuleUpdateResponse.Parameters;
    /**
     * Cloud Provider type
     */
    provider?: 'aws_s3' | 'cloudflare_r2' | 'gcp_storage' | 'azure_storage';
}
export declare namespace RuleUpdateResponse {
    /**
     * Parameters of Cloud Connector Rule
     */
    interface Parameters {
        /**
         * Host to perform Cloud Connection to
         */
        host?: string;
    }
}
export interface RuleListResponse {
    id?: string;
    description?: string;
    enabled?: boolean;
    expression?: string;
    /**
     * Parameters of Cloud Connector Rule
     */
    parameters?: RuleListResponse.Parameters;
    /**
     * Cloud Provider type
     */
    provider?: 'aws_s3' | 'cloudflare_r2' | 'gcp_storage' | 'azure_storage';
}
export declare namespace RuleListResponse {
    /**
     * Parameters of Cloud Connector Rule
     */
    interface Parameters {
        /**
         * Host to perform Cloud Connection to
         */
        host?: string;
    }
}
export interface RuleUpdateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param:
     */
    rules?: Array<RuleUpdateParams.Rule>;
}
export declare namespace RuleUpdateParams {
    interface Rule {
        id?: string;
        description?: string;
        enabled?: boolean;
        expression?: string;
        /**
         * Parameters of Cloud Connector Rule
         */
        parameters?: Rule.Parameters;
        /**
         * Cloud Provider type
         */
        provider?: 'aws_s3' | 'cloudflare_r2' | 'gcp_storage' | 'azure_storage';
    }
    namespace Rule {
        /**
         * Parameters of Cloud Connector Rule
         */
        interface Parameters {
            /**
             * Host to perform Cloud Connection to
             */
            host?: string;
        }
    }
}
export interface RuleListParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace Rules {
    export { type RuleUpdateResponse as RuleUpdateResponse, type RuleListResponse as RuleListResponse, RuleUpdateResponsesSinglePage as RuleUpdateResponsesSinglePage, RuleListResponsesSinglePage as RuleListResponsesSinglePage, type RuleUpdateParams as RuleUpdateParams, type RuleListParams as RuleListParams, };
}
//# sourceMappingURL=rules.d.ts.map