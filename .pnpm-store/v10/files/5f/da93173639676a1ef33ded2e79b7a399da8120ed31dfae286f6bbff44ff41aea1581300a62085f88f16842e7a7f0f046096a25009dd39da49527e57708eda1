import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { SinglePage } from "../../pagination.js";
export declare class Domains extends APIResource {
    /**
     * Attaches a Worker to a zone and hostname.
     *
     * @example
     * ```ts
     * const domain = await client.workers.domains.update({
     *   account_id: '9a7806061c88ada191ed06f989cc3dac',
     *   environment: 'production',
     *   hostname: 'foo.example.com',
     *   service: 'foo',
     *   zone_id: '593c9c94de529bbbfaac7c53ced0447d',
     * });
     * ```
     */
    update(params: DomainUpdateParams, options?: Core.RequestOptions): Core.APIPromise<Domain>;
    /**
     * Lists all Worker Domains for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const domain of client.workers.domains.list({
     *   account_id: '9a7806061c88ada191ed06f989cc3dac',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params: DomainListParams, options?: Core.RequestOptions): Core.PagePromise<DomainsSinglePage, Domain>;
    /**
     * Detaches a Worker from a zone and hostname.
     *
     * @example
     * ```ts
     * await client.workers.domains.delete(
     *   'dbe10b4bc17c295377eabd600e1787fd',
     *   { account_id: '9a7806061c88ada191ed06f989cc3dac' },
     * );
     * ```
     */
    delete(domainId: string, params: DomainDeleteParams, options?: Core.RequestOptions): Core.APIPromise<void>;
    /**
     * Gets a Worker domain.
     *
     * @example
     * ```ts
     * const domain = await client.workers.domains.get(
     *   'dbe10b4bc17c295377eabd600e1787fd',
     *   { account_id: '9a7806061c88ada191ed06f989cc3dac' },
     * );
     * ```
     */
    get(domainId: string, params: DomainGetParams, options?: Core.RequestOptions): Core.APIPromise<Domain>;
}
export declare class DomainsSinglePage extends SinglePage<Domain> {
}
export interface Domain {
    /**
     * Identifer of the Worker Domain.
     */
    id?: string;
    /**
     * Worker environment associated with the zone and hostname.
     */
    environment?: string;
    /**
     * Hostname of the Worker Domain.
     */
    hostname?: string;
    /**
     * Worker service associated with the zone and hostname.
     */
    service?: string;
    /**
     * Identifier of the zone.
     */
    zone_id?: string;
    /**
     * Name of the zone.
     */
    zone_name?: string;
}
export interface DomainUpdateParams {
    /**
     * Path param: Identifer of the account.
     */
    account_id: string;
    /**
     * Body param: Worker environment associated with the zone and hostname.
     */
    environment: string;
    /**
     * Body param: Hostname of the Worker Domain.
     */
    hostname: string;
    /**
     * Body param: Worker service associated with the zone and hostname.
     */
    service: string;
    /**
     * Body param: Identifier of the zone.
     */
    zone_id: string;
}
export interface DomainListParams {
    /**
     * Path param: Identifer of the account.
     */
    account_id: string;
    /**
     * Query param: Worker environment associated with the zone and hostname.
     */
    environment?: string;
    /**
     * Query param: Hostname of the Worker Domain.
     */
    hostname?: string;
    /**
     * Query param: Worker service associated with the zone and hostname.
     */
    service?: string;
    /**
     * Query param: Identifier of the zone.
     */
    zone_id?: string;
    /**
     * Query param: Name of the zone.
     */
    zone_name?: string;
}
export interface DomainDeleteParams {
    /**
     * Identifer of the account.
     */
    account_id: string;
}
export interface DomainGetParams {
    /**
     * Identifer of the account.
     */
    account_id: string;
}
export declare namespace Domains {
    export { type Domain as Domain, DomainsSinglePage as DomainsSinglePage, type DomainUpdateParams as DomainUpdateParams, type DomainListParams as DomainListParams, type DomainDeleteParams as DomainDeleteParams, type DomainGetParams as DomainGetParams, };
}
//# sourceMappingURL=domains.d.ts.map