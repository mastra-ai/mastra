import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Tail extends APIResource {
    /**
     * Starts a tail that receives logs and exception from a Worker.
     *
     * @example
     * ```ts
     * const tail = await client.workers.scripts.tail.create(
     *   'this-is_my_script-01',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: {},
     *   },
     * );
     * ```
     */
    create(scriptName: string, params: TailCreateParams, options?: Core.RequestOptions): Core.APIPromise<TailCreateResponse>;
    /**
     * Deletes a tail from a Worker.
     *
     * @example
     * ```ts
     * const tail = await client.workers.scripts.tail.delete(
     *   'this-is_my_script-01',
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(scriptName: string, id: string, params: TailDeleteParams, options?: Core.RequestOptions): Core.APIPromise<TailDeleteResponse>;
    /**
     * Get list of tails currently deployed on a Worker.
     *
     * @example
     * ```ts
     * const tail = await client.workers.scripts.tail.get(
     *   'this-is_my_script-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(scriptName: string, params: TailGetParams, options?: Core.RequestOptions): Core.APIPromise<TailGetResponse>;
}
/**
 * A reference to a script that will consume logs from the attached Worker.
 */
export interface ConsumerScript {
    /**
     * Name of Worker that is to be the consumer.
     */
    service: string;
    /**
     * Optional environment if the Worker utilizes one.
     */
    environment?: string;
    /**
     * Optional dispatch namespace the script belongs to.
     */
    namespace?: string;
}
/**
 * A reference to a script that will consume logs from the attached Worker.
 */
export interface ConsumerScriptParam {
    /**
     * Name of Worker that is to be the consumer.
     */
    service: string;
    /**
     * Optional environment if the Worker utilizes one.
     */
    environment?: string;
    /**
     * Optional dispatch namespace the script belongs to.
     */
    namespace?: string;
}
export interface TailCreateResponse {
    /**
     * Identifier.
     */
    id: string;
    expires_at: string;
    url: string;
}
export interface TailDeleteResponse {
    errors: Array<TailDeleteResponse.Error>;
    messages: Array<TailDeleteResponse.Message>;
    /**
     * Whether the API call was successful.
     */
    success: true;
}
export declare namespace TailDeleteResponse {
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
export interface TailGetResponse {
    /**
     * Identifier.
     */
    id: string;
    expires_at: string;
    url: string;
}
export interface TailCreateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param:
     */
    body: unknown;
}
export interface TailDeleteParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface TailGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Tail {
    export { type ConsumerScript as ConsumerScript, type TailCreateResponse as TailCreateResponse, type TailDeleteResponse as TailDeleteResponse, type TailGetResponse as TailGetResponse, type TailCreateParams as TailCreateParams, type TailDeleteParams as TailDeleteParams, type TailGetParams as TailGetParams, };
}
//# sourceMappingURL=tail.d.ts.map