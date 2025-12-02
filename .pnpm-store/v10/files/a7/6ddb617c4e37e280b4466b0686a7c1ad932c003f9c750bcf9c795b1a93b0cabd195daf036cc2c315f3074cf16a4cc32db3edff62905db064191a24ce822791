import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Accounts extends APIResource {
    /**
     * Add an account as a member of a particular address map.
     *
     * @example
     * ```ts
     * const account =
     *   await client.addressing.addressMaps.accounts.update(
     *     '055817b111884e0227e1be16a0be6ee0',
     *     {
     *       account_id: '258def64c72dae45f3e4c8516e2111f2',
     *       body: {},
     *     },
     *   );
     * ```
     */
    update(addressMapId: string, params: AccountUpdateParams, options?: Core.RequestOptions): Core.APIPromise<AccountUpdateResponse>;
    /**
     * Remove an account as a member of a particular address map.
     *
     * @example
     * ```ts
     * const account =
     *   await client.addressing.addressMaps.accounts.delete(
     *     '055817b111884e0227e1be16a0be6ee0',
     *     { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     *   );
     * ```
     */
    delete(addressMapId: string, params: AccountDeleteParams, options?: Core.RequestOptions): Core.APIPromise<AccountDeleteResponse>;
}
export interface AccountUpdateResponse {
    errors: Array<AccountUpdateResponse.Error>;
    messages: Array<AccountUpdateResponse.Message>;
    /**
     * Whether the API call was successful.
     */
    success: true;
    result_info?: AccountUpdateResponse.ResultInfo;
}
export declare namespace AccountUpdateResponse {
    interface Error {
        code: number;
        message: string;
        documentation_url?: string;
        source?: Error.Source;
    }
    namespace Error {
        interface Source {
            pointer?: string;
        }
    }
    interface Message {
        code: number;
        message: string;
        documentation_url?: string;
        source?: Message.Source;
    }
    namespace Message {
        interface Source {
            pointer?: string;
        }
    }
    interface ResultInfo {
        /**
         * Total number of results for the requested service.
         */
        count?: number;
        /**
         * Current page within paginated list of results.
         */
        page?: number;
        /**
         * Number of results per page of results.
         */
        per_page?: number;
        /**
         * Total results available without any search parameters.
         */
        total_count?: number;
    }
}
export interface AccountDeleteResponse {
    errors: Array<AccountDeleteResponse.Error>;
    messages: Array<AccountDeleteResponse.Message>;
    /**
     * Whether the API call was successful.
     */
    success: true;
    result_info?: AccountDeleteResponse.ResultInfo;
}
export declare namespace AccountDeleteResponse {
    interface Error {
        code: number;
        message: string;
        documentation_url?: string;
        source?: Error.Source;
    }
    namespace Error {
        interface Source {
            pointer?: string;
        }
    }
    interface Message {
        code: number;
        message: string;
        documentation_url?: string;
        source?: Message.Source;
    }
    namespace Message {
        interface Source {
            pointer?: string;
        }
    }
    interface ResultInfo {
        /**
         * Total number of results for the requested service.
         */
        count?: number;
        /**
         * Current page within paginated list of results.
         */
        page?: number;
        /**
         * Number of results per page of results.
         */
        per_page?: number;
        /**
         * Total results available without any search parameters.
         */
        total_count?: number;
    }
}
export interface AccountUpdateParams {
    /**
     * Path param: Identifier of a Cloudflare account.
     */
    account_id: string;
    /**
     * Body param:
     */
    body: unknown;
}
export interface AccountDeleteParams {
    /**
     * Identifier of a Cloudflare account.
     */
    account_id: string;
}
export declare namespace Accounts {
    export { type AccountUpdateResponse as AccountUpdateResponse, type AccountDeleteResponse as AccountDeleteResponse, type AccountUpdateParams as AccountUpdateParams, type AccountDeleteParams as AccountDeleteParams, };
}
//# sourceMappingURL=accounts.d.ts.map