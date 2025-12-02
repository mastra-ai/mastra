import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as ConfigAPI from "../config.js";
export declare class Configs extends APIResource {
    /**
     * Gets a history of published Zaraz configurations by ID(s) for a zone.
     *
     * @example
     * ```ts
     * const config = await client.zaraz.history.configs.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   ids: [0],
     * });
     * ```
     */
    get(params: ConfigGetParams, options?: Core.RequestOptions): Core.APIPromise<ConfigGetResponse>;
}
/**
 * Object where keys are numericc onfiguration IDs
 */
export type ConfigGetResponse = {
    [key: string]: ConfigGetResponse.item;
};
export declare namespace ConfigGetResponse {
    interface item {
        /**
         * ID of the configuration
         */
        id: number;
        /**
         * Zaraz configuration
         */
        config: ConfigAPI.Configuration;
        /**
         * Date and time the configuration was created
         */
        createdAt: string;
        /**
         * Date and time the configuration was last updated
         */
        updatedAt: string;
        /**
         * Alpha-numeric ID of the account user who published the configuration
         */
        userId: string;
    }
}
export interface ConfigGetParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Query param: Comma separated list of Zaraz configuration IDs
     */
    ids: Array<number>;
}
export declare namespace Configs {
    export { type ConfigGetResponse as ConfigGetResponse, type ConfigGetParams as ConfigGetParams };
}
//# sourceMappingURL=configs.d.ts.map