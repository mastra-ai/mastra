import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Subdomains extends APIResource {
    /**
     * Creates a Workers subdomain for an account.
     *
     * @example
     * ```ts
     * const subdomain = await client.workers.subdomains.update({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   subdomain: 'my-subdomain',
     * });
     * ```
     */
    update(params: SubdomainUpdateParams, options?: Core.RequestOptions): Core.APIPromise<SubdomainUpdateResponse>;
    /**
     * Returns a Workers subdomain for an account.
     *
     * @example
     * ```ts
     * const subdomain = await client.workers.subdomains.get({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: SubdomainGetParams, options?: Core.RequestOptions): Core.APIPromise<SubdomainGetResponse>;
}
export interface SubdomainUpdateResponse {
    subdomain: string;
}
export interface SubdomainGetResponse {
    subdomain: string;
}
export interface SubdomainUpdateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param:
     */
    subdomain: string;
}
export interface SubdomainGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Subdomains {
    export { type SubdomainUpdateResponse as SubdomainUpdateResponse, type SubdomainGetResponse as SubdomainGetResponse, type SubdomainUpdateParams as SubdomainUpdateParams, type SubdomainGetParams as SubdomainGetParams, };
}
//# sourceMappingURL=subdomains.d.ts.map