import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import { SinglePage } from "../../../pagination.js";
export declare class TSIGs extends APIResource {
    /**
     * Create TSIG.
     *
     * @example
     * ```ts
     * const tsig = await client.dns.zoneTransfers.tsigs.create({
     *   account_id: '01a7362d577a6c3019a474fd6f485823',
     *   algo: 'hmac-sha512.',
     *   name: 'tsig.customer.cf.',
     *   secret:
     *     'caf79a7804b04337c9c66ccd7bef9190a1e1679b5dd03d8aa10f7ad45e1a9dab92b417896c15d4d007c7c14194538d2a5d0feffdecc5a7f0e1c570cfa700837c',
     * });
     * ```
     */
    create(params: TSIGCreateParams, options?: Core.RequestOptions): Core.APIPromise<TSIG>;
    /**
     * Modify TSIG.
     *
     * @example
     * ```ts
     * const tsig = await client.dns.zoneTransfers.tsigs.update(
     *   '69cd1e104af3e6ed3cb344f263fd0d5a',
     *   {
     *     account_id: '01a7362d577a6c3019a474fd6f485823',
     *     algo: 'hmac-sha512.',
     *     name: 'tsig.customer.cf.',
     *     secret:
     *       'caf79a7804b04337c9c66ccd7bef9190a1e1679b5dd03d8aa10f7ad45e1a9dab92b417896c15d4d007c7c14194538d2a5d0feffdecc5a7f0e1c570cfa700837c',
     *   },
     * );
     * ```
     */
    update(tsigId: string, params: TSIGUpdateParams, options?: Core.RequestOptions): Core.APIPromise<TSIG>;
    /**
     * List TSIGs.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const tsig of client.dns.zoneTransfers.tsigs.list(
     *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params: TSIGListParams, options?: Core.RequestOptions): Core.PagePromise<TSIGsSinglePage, TSIG>;
    /**
     * Delete TSIG.
     *
     * @example
     * ```ts
     * const tsig = await client.dns.zoneTransfers.tsigs.delete(
     *   '69cd1e104af3e6ed3cb344f263fd0d5a',
     *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
     * );
     * ```
     */
    delete(tsigId: string, params: TSIGDeleteParams, options?: Core.RequestOptions): Core.APIPromise<TSIGDeleteResponse>;
    /**
     * Get TSIG.
     *
     * @example
     * ```ts
     * const tsig = await client.dns.zoneTransfers.tsigs.get(
     *   '69cd1e104af3e6ed3cb344f263fd0d5a',
     *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
     * );
     * ```
     */
    get(tsigId: string, params: TSIGGetParams, options?: Core.RequestOptions): Core.APIPromise<TSIG>;
}
export declare class TSIGsSinglePage extends SinglePage<TSIG> {
}
export interface TSIG {
    id: string;
    /**
     * TSIG algorithm.
     */
    algo: string;
    /**
     * TSIG key name.
     */
    name: string;
    /**
     * TSIG secret.
     */
    secret: string;
}
export interface TSIGDeleteResponse {
    id?: string;
}
export interface TSIGCreateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: TSIG algorithm.
     */
    algo: string;
    /**
     * Body param: TSIG key name.
     */
    name: string;
    /**
     * Body param: TSIG secret.
     */
    secret: string;
}
export interface TSIGUpdateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: TSIG algorithm.
     */
    algo: string;
    /**
     * Body param: TSIG key name.
     */
    name: string;
    /**
     * Body param: TSIG secret.
     */
    secret: string;
}
export interface TSIGListParams {
    account_id: string;
}
export interface TSIGDeleteParams {
    account_id: string;
}
export interface TSIGGetParams {
    account_id: string;
}
export declare namespace TSIGs {
    export { type TSIG as TSIG, type TSIGDeleteResponse as TSIGDeleteResponse, TSIGsSinglePage as TSIGsSinglePage, type TSIGCreateParams as TSIGCreateParams, type TSIGUpdateParams as TSIGUpdateParams, type TSIGListParams as TSIGListParams, type TSIGDeleteParams as TSIGDeleteParams, type TSIGGetParams as TSIGGetParams, };
}
//# sourceMappingURL=tsigs.d.ts.map