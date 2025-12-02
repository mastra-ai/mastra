import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
export declare class Metadata extends APIResource {
    /**
     * Returns the metadata associated with the given key in the given namespace. Use
     * URL-encoding to use special characters (for example, `:`, `!`, `%`) in the key
     * name.
     *
     * @example
     * ```ts
     * const metadata = await client.kv.namespaces.metadata.get(
     *   '0f2ac74b498b48028cb68387c421e279',
     *   'My-Key',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(namespaceId: string, keyName: string, params: MetadataGetParams, options?: Core.RequestOptions): Core.APIPromise<MetadataGetResponse>;
}
export type MetadataGetResponse = unknown;
export interface MetadataGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Metadata {
    export { type MetadataGetResponse as MetadataGetResponse, type MetadataGetParams as MetadataGetParams };
}
//# sourceMappingURL=metadata.d.ts.map