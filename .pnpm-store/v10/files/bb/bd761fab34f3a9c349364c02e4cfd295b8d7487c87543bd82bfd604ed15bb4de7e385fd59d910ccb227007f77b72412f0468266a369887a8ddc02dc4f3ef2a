import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Revoke extends APIResource {
    /**
     * Revokes a list of devices. Not supported when
     * [multi-user mode](https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/deployment/mdm-deployment/windows-multiuser/)
     * is enabled.
     *
     * **Deprecated**: please use POST
     * /accounts/{account_id}/devices/registrations/revoke instead.
     *
     * @deprecated
     */
    create(params: RevokeCreateParams, options?: Core.RequestOptions): Core.APIPromise<RevokeCreateResponse | null>;
}
export type RevokeCreateResponse = unknown | string;
export interface RevokeCreateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: A list of Registration IDs to revoke.
     */
    body: Array<string>;
}
export declare namespace Revoke {
    export { type RevokeCreateResponse as RevokeCreateResponse, type RevokeCreateParams as RevokeCreateParams };
}
//# sourceMappingURL=revoke.d.ts.map