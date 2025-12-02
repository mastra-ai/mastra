import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class Integration extends APIResource {
    /**
     * This will update an existing integration entry
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.dlp.entries.integration.create({
     *     account_id: 'account_id',
     *     enabled: true,
     *     entry_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   });
     * ```
     */
    create(params: IntegrationCreateParams, options?: Core.RequestOptions): Core.APIPromise<IntegrationCreateResponse>;
    /**
     * Updates a DLP entry.
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.dlp.entries.integration.update(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id', enabled: true },
     *   );
     * ```
     */
    update(entryId: string, params: IntegrationUpdateParams, options?: Core.RequestOptions): Core.APIPromise<IntegrationUpdateResponse>;
    /**
     * This is a no-op as integration entires can't be deleted but is needed for our
     * generated terraform API
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.dlp.entries.integration.delete(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(entryId: string, params: IntegrationDeleteParams, options?: Core.RequestOptions): Core.APIPromise<IntegrationDeleteResponse | null>;
}
export interface IntegrationCreateResponse {
    id: string;
    created_at: string;
    enabled: boolean;
    name: string;
    updated_at: string;
    profile_id?: string | null;
}
export interface IntegrationUpdateResponse {
    id: string;
    created_at: string;
    enabled: boolean;
    name: string;
    updated_at: string;
    profile_id?: string | null;
}
export type IntegrationDeleteResponse = unknown;
export interface IntegrationCreateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    enabled: boolean;
    /**
     * Body param:
     */
    entry_id: string;
    /**
     * Body param: This field is not actually used as the owning profile for a
     * predefined entry is already set to a predefined profile
     */
    profile_id?: string | null;
}
export interface IntegrationUpdateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    enabled: boolean;
}
export interface IntegrationDeleteParams {
    account_id: string;
}
export declare namespace Integration {
    export { type IntegrationCreateResponse as IntegrationCreateResponse, type IntegrationUpdateResponse as IntegrationUpdateResponse, type IntegrationDeleteResponse as IntegrationDeleteResponse, type IntegrationCreateParams as IntegrationCreateParams, type IntegrationUpdateParams as IntegrationUpdateParams, type IntegrationDeleteParams as IntegrationDeleteParams, };
}
//# sourceMappingURL=integration.d.ts.map