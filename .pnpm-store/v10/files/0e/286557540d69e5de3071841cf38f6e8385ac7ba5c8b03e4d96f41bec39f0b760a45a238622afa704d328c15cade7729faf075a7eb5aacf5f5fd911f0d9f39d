import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Subdomain extends APIResource {
    /**
     * Enable or disable the Worker on the workers.dev subdomain.
     *
     * @example
     * ```ts
     * const subdomain =
     *   await client.workers.scripts.subdomain.create(
     *     'this-is_my_script-01',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       enabled: true,
     *     },
     *   );
     * ```
     */
    create(scriptName: string, params: SubdomainCreateParams, options?: Core.RequestOptions): Core.APIPromise<SubdomainCreateResponse>;
    /**
     * Disable all workers.dev subdomains for a Worker.
     *
     * @example
     * ```ts
     * const subdomain =
     *   await client.workers.scripts.subdomain.delete(
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(scriptName: string, params: SubdomainDeleteParams, options?: Core.RequestOptions): Core.APIPromise<SubdomainDeleteResponse>;
    /**
     * Get if the Worker is available on the workers.dev subdomain.
     *
     * @example
     * ```ts
     * const subdomain =
     *   await client.workers.scripts.subdomain.get(
     *     'this-is_my_script-01',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(scriptName: string, params: SubdomainGetParams, options?: Core.RequestOptions): Core.APIPromise<SubdomainGetResponse>;
}
export interface SubdomainCreateResponse {
    /**
     * Whether the Worker is available on the workers.dev subdomain.
     */
    enabled: boolean;
    /**
     * Whether the Worker's Preview URLs are available on the workers.dev subdomain.
     */
    previews_enabled: boolean;
}
export interface SubdomainDeleteResponse {
    /**
     * Whether the Worker is available on the workers.dev subdomain.
     */
    enabled: boolean;
    /**
     * Whether the Worker's Preview URLs are available on the workers.dev subdomain.
     */
    previews_enabled: boolean;
}
export interface SubdomainGetResponse {
    /**
     * Whether the Worker is available on the workers.dev subdomain.
     */
    enabled: boolean;
    /**
     * Whether the Worker's Preview URLs are available on the workers.dev subdomain.
     */
    previews_enabled: boolean;
}
export interface SubdomainCreateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: Whether the Worker should be available on the workers.dev subdomain.
     */
    enabled: boolean;
    /**
     * Body param: Whether the Worker's Preview URLs should be available on the
     * workers.dev subdomain.
     */
    previews_enabled?: boolean;
}
export interface SubdomainDeleteParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface SubdomainGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Subdomain {
    export { type SubdomainCreateResponse as SubdomainCreateResponse, type SubdomainDeleteResponse as SubdomainDeleteResponse, type SubdomainGetResponse as SubdomainGetResponse, type SubdomainCreateParams as SubdomainCreateParams, type SubdomainDeleteParams as SubdomainDeleteParams, type SubdomainGetParams as SubdomainGetParams, };
}
//# sourceMappingURL=subdomain.d.ts.map