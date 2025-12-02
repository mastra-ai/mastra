import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import { SinglePage } from "../../../../pagination.js";
export declare class CAs extends APIResource {
    /**
     * Generates a new short-lived certificate CA and public key.
     *
     * @example
     * ```ts
     * const ca =
     *   await client.zeroTrust.access.applications.cas.create(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    create(appId: string, params?: CACreateParams, options?: Core.RequestOptions): Core.APIPromise<CA>;
    create(appId: string, options?: Core.RequestOptions): Core.APIPromise<CA>;
    /**
     * Lists short-lived certificate CAs and their public keys.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const ca of client.zeroTrust.access.applications.cas.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params?: CAListParams, options?: Core.RequestOptions): Core.PagePromise<CAsSinglePage, CA>;
    list(options?: Core.RequestOptions): Core.PagePromise<CAsSinglePage, CA>;
    /**
     * Deletes a short-lived certificate CA.
     *
     * @example
     * ```ts
     * const ca =
     *   await client.zeroTrust.access.applications.cas.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(appId: string, params?: CADeleteParams, options?: Core.RequestOptions): Core.APIPromise<CADeleteResponse>;
    delete(appId: string, options?: Core.RequestOptions): Core.APIPromise<CADeleteResponse>;
    /**
     * Fetches a short-lived certificate CA and its public key.
     *
     * @example
     * ```ts
     * const ca =
     *   await client.zeroTrust.access.applications.cas.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(appId: string, params?: CAGetParams, options?: Core.RequestOptions): Core.APIPromise<CA>;
    get(appId: string, options?: Core.RequestOptions): Core.APIPromise<CA>;
}
export declare class CAsSinglePage extends SinglePage<CA> {
}
export interface CA {
    /**
     * The ID of the CA.
     */
    id?: string;
    /**
     * The Application Audience (AUD) tag. Identifies the application associated with
     * the CA.
     */
    aud?: string;
    /**
     * The public key to add to your SSH server configuration.
     */
    public_key?: string;
}
export interface CADeleteResponse {
    /**
     * The ID of the CA.
     */
    id?: string;
}
export interface CACreateParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export interface CAListParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export interface CADeleteParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export interface CAGetParams {
    /**
     * The Account ID to use for this endpoint. Mutually exclusive with the Zone ID.
     */
    account_id?: string;
    /**
     * The Zone ID to use for this endpoint. Mutually exclusive with the Account ID.
     */
    zone_id?: string;
}
export declare namespace CAs {
    export { type CA as CA, type CADeleteResponse as CADeleteResponse, CAsSinglePage as CAsSinglePage, type CACreateParams as CACreateParams, type CAListParams as CAListParams, type CADeleteParams as CADeleteParams, type CAGetParams as CAGetParams, };
}
//# sourceMappingURL=cas.d.ts.map