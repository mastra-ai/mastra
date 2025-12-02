import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class AddressSpaces extends APIResource {
    /**
     * Update the Magic WAN Address Space (Closed Beta).
     */
    update(params: AddressSpaceUpdateParams, options?: Core.RequestOptions): Core.APIPromise<AddressSpaceUpdateResponse>;
    /**
     * Read the Magic WAN Address Space (Closed Beta).
     */
    list(params: AddressSpaceListParams, options?: Core.RequestOptions): Core.APIPromise<AddressSpaceListResponse>;
    /**
     * Update the Magic WAN Address Space (Closed Beta).
     */
    edit(params: AddressSpaceEditParams, options?: Core.RequestOptions): Core.APIPromise<AddressSpaceEditResponse>;
}
export interface AddressSpaceUpdateResponse {
    prefixes: Array<string>;
}
export interface AddressSpaceListResponse {
    prefixes: Array<string>;
}
export interface AddressSpaceEditResponse {
    prefixes: Array<string>;
}
export interface AddressSpaceUpdateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    prefixes: Array<string>;
}
export interface AddressSpaceListParams {
    account_id: string;
}
export interface AddressSpaceEditParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    prefixes: Array<string>;
}
export declare namespace AddressSpaces {
    export { type AddressSpaceUpdateResponse as AddressSpaceUpdateResponse, type AddressSpaceListResponse as AddressSpaceListResponse, type AddressSpaceEditResponse as AddressSpaceEditResponse, type AddressSpaceUpdateParams as AddressSpaceUpdateParams, type AddressSpaceListParams as AddressSpaceListParams, type AddressSpaceEditParams as AddressSpaceEditParams, };
}
//# sourceMappingURL=address-spaces.d.ts.map