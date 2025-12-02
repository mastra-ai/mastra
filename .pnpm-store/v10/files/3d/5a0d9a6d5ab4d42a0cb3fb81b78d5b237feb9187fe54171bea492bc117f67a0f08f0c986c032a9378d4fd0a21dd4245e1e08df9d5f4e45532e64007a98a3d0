import { APIResource } from "../resource.js";
import * as Core from "../core.js";
export declare class SecurityTXT extends APIResource {
    /**
     * Update security.txt
     *
     * @example
     * ```ts
     * const securityTXT = await client.securityTXT.update({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    update(params: SecurityTXTUpdateParams, options?: Core.RequestOptions): Core.APIPromise<SecurityTXTUpdateResponse>;
    /**
     * Delete security.txt
     *
     * @example
     * ```ts
     * const securityTXT = await client.securityTXT.delete({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    delete(params: SecurityTXTDeleteParams, options?: Core.RequestOptions): Core.APIPromise<SecurityTXTDeleteResponse>;
    /**
     * Get security.txt
     *
     * @example
     * ```ts
     * const securityTXT = await client.securityTXT.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params: SecurityTXTGetParams, options?: Core.RequestOptions): Core.APIPromise<SecurityTXTGetResponse>;
}
export interface SecurityTXTUpdateResponse {
    errors: Array<SecurityTXTUpdateResponse.Error>;
    messages: Array<SecurityTXTUpdateResponse.Message>;
    /**
     * Whether the API call was successful.
     */
    success: true;
}
export declare namespace SecurityTXTUpdateResponse {
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
}
export interface SecurityTXTDeleteResponse {
    errors: Array<SecurityTXTDeleteResponse.Error>;
    messages: Array<SecurityTXTDeleteResponse.Message>;
    /**
     * Whether the API call was successful.
     */
    success: true;
}
export declare namespace SecurityTXTDeleteResponse {
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
}
export interface SecurityTXTGetResponse {
    acknowledgments?: Array<string>;
    canonical?: Array<string>;
    contact?: Array<string>;
    enabled?: boolean;
    encryption?: Array<string>;
    expires?: string;
    hiring?: Array<string>;
    policy?: Array<string>;
    preferredLanguages?: string;
}
export interface SecurityTXTUpdateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param:
     */
    acknowledgments?: Array<string>;
    /**
     * Body param:
     */
    canonical?: Array<string>;
    /**
     * Body param:
     */
    contact?: Array<string>;
    /**
     * Body param:
     */
    enabled?: boolean;
    /**
     * Body param:
     */
    encryption?: Array<string>;
    /**
     * Body param:
     */
    expires?: string;
    /**
     * Body param:
     */
    hiring?: Array<string>;
    /**
     * Body param:
     */
    policy?: Array<string>;
    /**
     * Body param:
     */
    preferredLanguages?: string;
}
export interface SecurityTXTDeleteParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export interface SecurityTXTGetParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export declare namespace SecurityTXT {
    export { type SecurityTXTUpdateResponse as SecurityTXTUpdateResponse, type SecurityTXTDeleteResponse as SecurityTXTDeleteResponse, type SecurityTXTGetResponse as SecurityTXTGetResponse, type SecurityTXTUpdateParams as SecurityTXTUpdateParams, type SecurityTXTDeleteParams as SecurityTXTDeleteParams, type SecurityTXTGetParams as SecurityTXTGetParams, };
}
//# sourceMappingURL=security-txt.d.ts.map