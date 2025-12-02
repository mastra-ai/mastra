import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class AccountMapping extends APIResource {
    /**
     * Create mapping
     *
     * @example
     * ```ts
     * const accountMapping =
     *   await client.zeroTrust.dlp.email.accountMapping.create({
     *     account_id: 'account_id',
     *     auth_requirements: {
     *       allowed_microsoft_organizations: ['string'],
     *       type: 'Org',
     *     },
     *   });
     * ```
     */
    create(params: AccountMappingCreateParams, options?: Core.RequestOptions): Core.APIPromise<AccountMappingCreateResponse>;
    /**
     * Get mapping
     *
     * @example
     * ```ts
     * const accountMapping =
     *   await client.zeroTrust.dlp.email.accountMapping.get({
     *     account_id: 'account_id',
     *   });
     * ```
     */
    get(params: AccountMappingGetParams, options?: Core.RequestOptions): Core.APIPromise<AccountMappingGetResponse>;
}
export interface AccountMappingCreateResponse {
    addin_identifier_token: string;
    auth_requirements: AccountMappingCreateResponse.UnionMember0 | AccountMappingCreateResponse.Type;
}
export declare namespace AccountMappingCreateResponse {
    interface UnionMember0 {
        allowed_microsoft_organizations: Array<string>;
        type: 'Org';
    }
    interface Type {
        type: 'NoAuth';
    }
}
export interface AccountMappingGetResponse {
    addin_identifier_token: string;
    auth_requirements: AccountMappingGetResponse.UnionMember0 | AccountMappingGetResponse.Type;
}
export declare namespace AccountMappingGetResponse {
    interface UnionMember0 {
        allowed_microsoft_organizations: Array<string>;
        type: 'Org';
    }
    interface Type {
        type: 'NoAuth';
    }
}
export interface AccountMappingCreateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    auth_requirements: AccountMappingCreateParams.UnionMember0 | AccountMappingCreateParams.Type;
}
export declare namespace AccountMappingCreateParams {
    interface UnionMember0 {
        allowed_microsoft_organizations: Array<string>;
        type: 'Org';
    }
    interface Type {
        type: 'NoAuth';
    }
}
export interface AccountMappingGetParams {
    account_id: string;
}
export declare namespace AccountMapping {
    export { type AccountMappingCreateResponse as AccountMappingCreateResponse, type AccountMappingGetResponse as AccountMappingGetResponse, type AccountMappingCreateParams as AccountMappingCreateParams, type AccountMappingGetParams as AccountMappingGetParams, };
}
//# sourceMappingURL=account-mapping.d.ts.map