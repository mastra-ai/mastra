import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
export declare class References extends APIResource {
    /**
     * Get risk score integration by reference id.
     *
     * @example
     * ```ts
     * const reference =
     *   await client.zeroTrust.riskScoring.integrations.references.get(
     *     'reference_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(referenceId: string, params: ReferenceGetParams, options?: Core.RequestOptions): Core.APIPromise<ReferenceGetResponse>;
}
export interface ReferenceGetResponse {
    /**
     * The id of the integration, a UUIDv4.
     */
    id: string;
    /**
     * The Cloudflare account tag.
     */
    account_tag: string;
    /**
     * Whether this integration is enabled and should export changes in risk score.
     */
    active: boolean;
    /**
     * When the integration was created in RFC3339 format.
     */
    created_at: string;
    integration_type: 'Okta';
    /**
     * A reference ID defined by the client. Should be set to the Access-Okta IDP
     * integration ID. Useful when the risk-score integration needs to be associated
     * with a secondary asset and recalled using that ID.
     */
    reference_id: string;
    /**
     * The base URL for the tenant. E.g. "https://tenant.okta.com".
     */
    tenant_url: string;
    /**
     * The URL for the Shared Signals Framework configuration, e.g.
     * "/.well-known/sse-configuration/{integration_uuid}/".
     * https://openid.net/specs/openid-sse-framework-1_0.html#rfc.section.6.2.1.
     */
    well_known_url: string;
}
export interface ReferenceGetParams {
    account_id: string;
}
export declare namespace References {
    export { type ReferenceGetResponse as ReferenceGetResponse, type ReferenceGetParams as ReferenceGetParams };
}
//# sourceMappingURL=references.d.ts.map