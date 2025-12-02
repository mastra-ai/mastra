import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as HostsAPI from "./hosts.js";
import { HostListParams, HostListResponse, HostListResponsesV4PagePaginationArray, Hosts } from "./hosts.js";
import * as OperationsAPI from "./operations.js";
import { OperationListParams, OperationListResponse, OperationListResponsesV4PagePaginationArray, Operations } from "./operations.js";
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from "../../../pagination.js";
export declare class UserSchemas extends APIResource {
    operations: OperationsAPI.Operations;
    hosts: HostsAPI.Hosts;
    /**
     * Upload a schema to a zone
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    create(params: UserSchemaCreateParams, options?: Core.RequestOptions): Core.APIPromise<SchemaUpload>;
    /**
     * Retrieve information about all schemas on a zone
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    list(params: UserSchemaListParams, options?: Core.RequestOptions): Core.PagePromise<PublicSchemasV4PagePaginationArray, PublicSchema>;
    /**
     * Delete a schema
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    delete(schemaId: string, params: UserSchemaDeleteParams, options?: Core.RequestOptions): Core.APIPromise<UserSchemaDeleteResponse>;
    /**
     * Enable validation for a schema
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    edit(schemaId: string, params: UserSchemaEditParams, options?: Core.RequestOptions): Core.APIPromise<PublicSchema>;
    /**
     * Retrieve information about a specific schema on a zone
     *
     * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
     */
    get(schemaId: string, params: UserSchemaGetParams, options?: Core.RequestOptions): Core.APIPromise<PublicSchema>;
}
export declare class PublicSchemasV4PagePaginationArray extends V4PagePaginationArray<PublicSchema> {
}
export type Message = Array<Message.MessageItem>;
export declare namespace Message {
    interface MessageItem {
        code: number;
        message: string;
        documentation_url?: string;
        source?: MessageItem.Source;
    }
    namespace MessageItem {
        interface Source {
            pointer?: string;
        }
    }
}
export interface PublicSchema {
    created_at: string;
    /**
     * Kind of schema
     */
    kind: 'openapi_v3';
    /**
     * Name of the schema
     */
    name: string;
    /**
     * UUID.
     */
    schema_id: string;
    /**
     * Source of the schema
     */
    source?: string;
    /**
     * Flag whether schema is enabled for validation.
     */
    validation_enabled?: boolean;
}
export interface SchemaUpload {
    schema: PublicSchema;
    upload_details?: SchemaUpload.UploadDetails;
}
export declare namespace SchemaUpload {
    interface UploadDetails {
        /**
         * Diagnostic warning events that occurred during processing. These events are
         * non-critical errors found within the schema.
         */
        warnings?: Array<UploadDetails.Warning>;
    }
    namespace UploadDetails {
        interface Warning {
            /**
             * Code that identifies the event that occurred.
             */
            code: number;
            /**
             * JSONPath location(s) in the schema where these events were encountered. See
             * [https://goessner.net/articles/JsonPath/](https://goessner.net/articles/JsonPath/)
             * for JSONPath specification.
             */
            locations?: Array<string>;
            /**
             * Diagnostic message that describes the event.
             */
            message?: string;
        }
    }
}
export interface UserSchemaDeleteResponse {
    errors: Message;
    messages: Message;
    /**
     * Whether the API call was successful.
     */
    success: true;
}
export interface UserSchemaCreateParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: Schema file bytes
     */
    file: Core.Uploadable;
    /**
     * Body param: Kind of schema
     */
    kind: 'openapi_v3';
    /**
     * Body param: Name of the schema
     */
    name?: string;
    /**
     * Body param: Flag whether schema is enabled for validation.
     */
    validation_enabled?: 'true' | 'false';
}
export interface UserSchemaListParams extends V4PagePaginationArrayParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Query param: Omit the source-files of schemas and only retrieve their meta-data.
     */
    omit_source?: boolean;
    /**
     * Query param: Flag whether schema is enabled for validation.
     */
    validation_enabled?: boolean;
}
export interface UserSchemaDeleteParams {
    /**
     * Identifier.
     */
    zone_id: string;
}
export interface UserSchemaEditParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Body param: Flag whether schema is enabled for validation.
     */
    validation_enabled?: true;
}
export interface UserSchemaGetParams {
    /**
     * Path param: Identifier.
     */
    zone_id: string;
    /**
     * Query param: Omit the source-files of schemas and only retrieve their meta-data.
     */
    omit_source?: boolean;
}
export declare namespace UserSchemas {
    export { type Message as Message, type PublicSchema as PublicSchema, type SchemaUpload as SchemaUpload, type UserSchemaDeleteResponse as UserSchemaDeleteResponse, PublicSchemasV4PagePaginationArray as PublicSchemasV4PagePaginationArray, type UserSchemaCreateParams as UserSchemaCreateParams, type UserSchemaListParams as UserSchemaListParams, type UserSchemaDeleteParams as UserSchemaDeleteParams, type UserSchemaEditParams as UserSchemaEditParams, type UserSchemaGetParams as UserSchemaGetParams, };
    export { Operations as Operations, type OperationListResponse as OperationListResponse, OperationListResponsesV4PagePaginationArray as OperationListResponsesV4PagePaginationArray, type OperationListParams as OperationListParams, };
    export { Hosts as Hosts, type HostListResponse as HostListResponse, HostListResponsesV4PagePaginationArray as HostListResponsesV4PagePaginationArray, type HostListParams as HostListParams, };
}
//# sourceMappingURL=user-schemas.d.ts.map