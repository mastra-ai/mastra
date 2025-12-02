// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as HostsAPI from './hosts';
import { HostListParams, HostListResponse, HostListResponsesV4PagePaginationArray, Hosts } from './hosts';
import * as OperationsAPI from './operations';
import {
  OperationListParams,
  OperationListResponse,
  OperationListResponsesV4PagePaginationArray,
  Operations,
} from './operations';
import { V4PagePaginationArray, type V4PagePaginationArrayParams } from '../../../pagination';

export class UserSchemas extends APIResource {
  operations: OperationsAPI.Operations = new OperationsAPI.Operations(this._client);
  hosts: HostsAPI.Hosts = new HostsAPI.Hosts(this._client);

  /**
   * Upload a schema to a zone
   *
   * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
   */
  create(params: UserSchemaCreateParams, options?: Core.RequestOptions): Core.APIPromise<SchemaUpload> {
    const { zone_id, ...body } = params;
    return (
      this._client.post(
        `/zones/${zone_id}/api_gateway/user_schemas`,
        Core.multipartFormRequestOptions({ body, ...options }),
      ) as Core.APIPromise<{ result: SchemaUpload }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieve information about all schemas on a zone
   *
   * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
   */
  list(
    params: UserSchemaListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<PublicSchemasV4PagePaginationArray, PublicSchema> {
    const { zone_id, ...query } = params;
    return this._client.getAPIList(
      `/zones/${zone_id}/api_gateway/user_schemas`,
      PublicSchemasV4PagePaginationArray,
      { query, ...options },
    );
  }

  /**
   * Delete a schema
   *
   * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
   */
  delete(
    schemaId: string,
    params: UserSchemaDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<UserSchemaDeleteResponse> {
    const { zone_id } = params;
    return this._client.delete(`/zones/${zone_id}/api_gateway/user_schemas/${schemaId}`, options);
  }

  /**
   * Enable validation for a schema
   *
   * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
   */
  edit(
    schemaId: string,
    params: UserSchemaEditParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PublicSchema> {
    const { zone_id, ...body } = params;
    return (
      this._client.patch(`/zones/${zone_id}/api_gateway/user_schemas/${schemaId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: PublicSchema }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Retrieve information about a specific schema on a zone
   *
   * @deprecated Use [Schema Validation API](https://developers.cloudflare.com/api/resources/schema_validation/) instead.
   */
  get(
    schemaId: string,
    params: UserSchemaGetParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<PublicSchema> {
    const { zone_id, ...query } = params;
    return (
      this._client.get(`/zones/${zone_id}/api_gateway/user_schemas/${schemaId}`, {
        query,
        ...options,
      }) as Core.APIPromise<{ result: PublicSchema }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class PublicSchemasV4PagePaginationArray extends V4PagePaginationArray<PublicSchema> {}

export type Message = Array<Message.MessageItem>;

export namespace Message {
  export interface MessageItem {
    code: number;

    message: string;

    documentation_url?: string;

    source?: MessageItem.Source;
  }

  export namespace MessageItem {
    export interface Source {
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

export namespace SchemaUpload {
  export interface UploadDetails {
    /**
     * Diagnostic warning events that occurred during processing. These events are
     * non-critical errors found within the schema.
     */
    warnings?: Array<UploadDetails.Warning>;
  }

  export namespace UploadDetails {
    export interface Warning {
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

UserSchemas.PublicSchemasV4PagePaginationArray = PublicSchemasV4PagePaginationArray;
UserSchemas.Operations = Operations;
UserSchemas.OperationListResponsesV4PagePaginationArray = OperationListResponsesV4PagePaginationArray;
UserSchemas.Hosts = Hosts;
UserSchemas.HostListResponsesV4PagePaginationArray = HostListResponsesV4PagePaginationArray;

export declare namespace UserSchemas {
  export {
    type Message as Message,
    type PublicSchema as PublicSchema,
    type SchemaUpload as SchemaUpload,
    type UserSchemaDeleteResponse as UserSchemaDeleteResponse,
    PublicSchemasV4PagePaginationArray as PublicSchemasV4PagePaginationArray,
    type UserSchemaCreateParams as UserSchemaCreateParams,
    type UserSchemaListParams as UserSchemaListParams,
    type UserSchemaDeleteParams as UserSchemaDeleteParams,
    type UserSchemaEditParams as UserSchemaEditParams,
    type UserSchemaGetParams as UserSchemaGetParams,
  };

  export {
    Operations as Operations,
    type OperationListResponse as OperationListResponse,
    OperationListResponsesV4PagePaginationArray as OperationListResponsesV4PagePaginationArray,
    type OperationListParams as OperationListParams,
  };

  export {
    Hosts as Hosts,
    type HostListResponse as HostListResponse,
    HostListResponsesV4PagePaginationArray as HostListResponsesV4PagePaginationArray,
    type HostListParams as HostListParams,
  };
}
