import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as IPFSUniversalPathsAPI from "./ipfs-universal-paths/ipfs-universal-paths.js";
import { IPFSUniversalPaths } from "./ipfs-universal-paths/ipfs-universal-paths.js";
import { SinglePage } from "../../../pagination.js";
export declare class Hostnames extends APIResource {
    ipfsUniversalPaths: IPFSUniversalPathsAPI.IPFSUniversalPaths;
    /**
     * Create Web3 Hostname
     *
     * @example
     * ```ts
     * const hostname = await client.web3.hostnames.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'gateway.example.com',
     *   target: 'ipfs',
     * });
     * ```
     */
    create(params: HostnameCreateParams, options?: Core.RequestOptions): Core.APIPromise<Hostname>;
    /**
     * List Web3 Hostnames
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const hostname of client.web3.hostnames.list({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params: HostnameListParams, options?: Core.RequestOptions): Core.PagePromise<HostnamesSinglePage, Hostname>;
    /**
     * Delete Web3 Hostname
     *
     * @example
     * ```ts
     * const hostname = await client.web3.hostnames.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(identifier: string, params: HostnameDeleteParams, options?: Core.RequestOptions): Core.APIPromise<HostnameDeleteResponse | null>;
    /**
     * Edit Web3 Hostname
     *
     * @example
     * ```ts
     * const hostname = await client.web3.hostnames.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(identifier: string, params: HostnameEditParams, options?: Core.RequestOptions): Core.APIPromise<Hostname>;
    /**
     * Web3 Hostname Details
     *
     * @example
     * ```ts
     * const hostname = await client.web3.hostnames.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(identifier: string, params: HostnameGetParams, options?: Core.RequestOptions): Core.APIPromise<Hostname>;
}
export declare class HostnamesSinglePage extends SinglePage<Hostname> {
}
export interface Hostname {
    /**
     * Specify the identifier of the hostname.
     */
    id?: string;
    created_on?: string;
    /**
     * Specify an optional description of the hostname.
     */
    description?: string;
    /**
     * Specify the DNSLink value used if the target is ipfs.
     */
    dnslink?: string;
    modified_on?: string;
    /**
     * Specify the hostname that points to the target gateway via CNAME.
     */
    name?: string;
    /**
     * Specifies the status of the hostname's activation.
     */
    status?: 'active' | 'pending' | 'deleting' | 'error';
    /**
     * Specify the target gateway of the hostname.
     */
    target?: 'ethereum' | 'ipfs' | 'ipfs_universal_path';
}
export interface HostnameDeleteResponse {
    /**
     * Specify the identifier of the hostname.
     */
    id: string;
}
export interface HostnameCreateParams {
    /**
     * Path param: Specify the identifier of the hostname.
     */
    zone_id: string;
    /**
     * Body param: Specify the hostname that points to the target gateway via CNAME.
     */
    name: string;
    /**
     * Body param: Specify the target gateway of the hostname.
     */
    target: 'ethereum' | 'ipfs' | 'ipfs_universal_path';
    /**
     * Body param: Specify an optional description of the hostname.
     */
    description?: string;
    /**
     * Body param: Specify the DNSLink value used if the target is ipfs.
     */
    dnslink?: string;
}
export interface HostnameListParams {
    /**
     * Specify the identifier of the hostname.
     */
    zone_id: string;
}
export interface HostnameDeleteParams {
    /**
     * Specify the identifier of the hostname.
     */
    zone_id: string;
}
export interface HostnameEditParams {
    /**
     * Path param: Specify the identifier of the hostname.
     */
    zone_id: string;
    /**
     * Body param: Specify an optional description of the hostname.
     */
    description?: string;
    /**
     * Body param: Specify the DNSLink value used if the target is ipfs.
     */
    dnslink?: string;
}
export interface HostnameGetParams {
    /**
     * Specify the identifier of the hostname.
     */
    zone_id: string;
}
export declare namespace Hostnames {
    export { type Hostname as Hostname, type HostnameDeleteResponse as HostnameDeleteResponse, HostnamesSinglePage as HostnamesSinglePage, type HostnameCreateParams as HostnameCreateParams, type HostnameListParams as HostnameListParams, type HostnameDeleteParams as HostnameDeleteParams, type HostnameEditParams as HostnameEditParams, type HostnameGetParams as HostnameGetParams, };
    export { IPFSUniversalPaths as IPFSUniversalPaths };
}
//# sourceMappingURL=hostnames.d.ts.map