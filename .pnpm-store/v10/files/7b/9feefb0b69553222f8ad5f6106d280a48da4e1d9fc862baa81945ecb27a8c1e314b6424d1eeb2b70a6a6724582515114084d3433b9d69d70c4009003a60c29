import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Unrevoke extends APIResource {
    /**
     * Unrevokes a list of devices. Not supported when
     * [multi-user mode](https://developers.cloudflare.com/cloudflare-one/connections/connect-devices/warp/deployment/mdm-deployment/windows-multiuser/)
     * is enabled.
     *
     * **Deprecated**: please use POST
     * /accounts/{account_id}/devices/registrations/unrevoke instead.
     *
     * @deprecated
     */
    create(params: UnrevokeCreateParams, options?: Core.RequestOptions): Core.APIPromise<UnrevokeCreateResponse | null>;
}
export type UnrevokeCreateResponse = unknown | string;
export interface UnrevokeCreateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param: A list of Registration IDs to unrevoke.
     */
    body: Array<string>;
}
export declare namespace Unrevoke {
    export { type UnrevokeCreateResponse as UnrevokeCreateResponse, type UnrevokeCreateParams as UnrevokeCreateParams, };
}
//# sourceMappingURL=unrevoke.d.ts.map