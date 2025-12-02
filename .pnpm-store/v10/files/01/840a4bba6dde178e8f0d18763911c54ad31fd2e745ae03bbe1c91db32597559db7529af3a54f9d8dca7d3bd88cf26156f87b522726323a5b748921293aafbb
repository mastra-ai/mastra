// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as ConfigurationsAPI from './configurations';
import {
  Configuration,
  ConfigurationGetParams,
  ConfigurationUpdateParams,
  ConfigurationUpdateResponse,
  Configurations,
} from './configurations';
import * as SchemasAPI from './schemas';
import { SchemaListParams, SchemaListResponse, Schemas } from './schemas';
import * as DiscoveryAPI from './discovery/discovery';
import {
  Discovery,
  DiscoveryGetParams,
  DiscoveryGetResponse,
  DiscoveryOperation,
} from './discovery/discovery';
import * as ExpressionTemplateAPI from './expression-template/expression-template';
import { ExpressionTemplate } from './expression-template/expression-template';
import * as OperationsAPI from './operations/operations';
import {
  APIShield,
  OperationBulkCreateParams,
  OperationBulkCreateResponse,
  OperationBulkCreateResponsesSinglePage,
  OperationBulkDeleteParams,
  OperationBulkDeleteResponse,
  OperationCreateParams,
  OperationCreateResponse,
  OperationDeleteParams,
  OperationDeleteResponse,
  OperationGetParams,
  OperationGetResponse,
  OperationListParams,
  OperationListResponse,
  OperationListResponsesV4PagePaginationArray,
  Operations,
} from './operations/operations';
import * as SettingsAPI from './settings/settings';
import { Settings } from './settings/settings';
import * as UserSchemasAPI from './user-schemas/user-schemas';
import {
  Message,
  PublicSchema,
  PublicSchemasV4PagePaginationArray,
  SchemaUpload,
  UserSchemaCreateParams,
  UserSchemaDeleteParams,
  UserSchemaDeleteResponse,
  UserSchemaEditParams,
  UserSchemaGetParams,
  UserSchemaListParams,
  UserSchemas,
} from './user-schemas/user-schemas';

export class APIGateway extends APIResource {
  configurations: ConfigurationsAPI.Configurations = new ConfigurationsAPI.Configurations(this._client);
  discovery: DiscoveryAPI.Discovery = new DiscoveryAPI.Discovery(this._client);
  operations: OperationsAPI.Operations = new OperationsAPI.Operations(this._client);
  schemas: SchemasAPI.Schemas = new SchemasAPI.Schemas(this._client);
  settings: SettingsAPI.Settings = new SettingsAPI.Settings(this._client);
  userSchemas: UserSchemasAPI.UserSchemas = new UserSchemasAPI.UserSchemas(this._client);
  expressionTemplate: ExpressionTemplateAPI.ExpressionTemplate = new ExpressionTemplateAPI.ExpressionTemplate(
    this._client,
  );
}

APIGateway.Configurations = Configurations;
APIGateway.Discovery = Discovery;
APIGateway.Operations = Operations;
APIGateway.OperationListResponsesV4PagePaginationArray = OperationListResponsesV4PagePaginationArray;
APIGateway.OperationBulkCreateResponsesSinglePage = OperationBulkCreateResponsesSinglePage;
APIGateway.Schemas = Schemas;
APIGateway.UserSchemas = UserSchemas;
APIGateway.PublicSchemasV4PagePaginationArray = PublicSchemasV4PagePaginationArray;
APIGateway.ExpressionTemplate = ExpressionTemplate;

export declare namespace APIGateway {
  export {
    Configurations as Configurations,
    type Configuration as Configuration,
    type ConfigurationUpdateResponse as ConfigurationUpdateResponse,
    type ConfigurationUpdateParams as ConfigurationUpdateParams,
    type ConfigurationGetParams as ConfigurationGetParams,
  };

  export {
    Discovery as Discovery,
    type DiscoveryOperation as DiscoveryOperation,
    type DiscoveryGetResponse as DiscoveryGetResponse,
    type DiscoveryGetParams as DiscoveryGetParams,
  };

  export {
    Operations as Operations,
    type APIShield as APIShield,
    type OperationCreateResponse as OperationCreateResponse,
    type OperationListResponse as OperationListResponse,
    type OperationDeleteResponse as OperationDeleteResponse,
    type OperationBulkCreateResponse as OperationBulkCreateResponse,
    type OperationBulkDeleteResponse as OperationBulkDeleteResponse,
    type OperationGetResponse as OperationGetResponse,
    OperationListResponsesV4PagePaginationArray as OperationListResponsesV4PagePaginationArray,
    OperationBulkCreateResponsesSinglePage as OperationBulkCreateResponsesSinglePage,
    type OperationCreateParams as OperationCreateParams,
    type OperationListParams as OperationListParams,
    type OperationDeleteParams as OperationDeleteParams,
    type OperationBulkCreateParams as OperationBulkCreateParams,
    type OperationBulkDeleteParams as OperationBulkDeleteParams,
    type OperationGetParams as OperationGetParams,
  };

  export {
    Schemas as Schemas,
    type SchemaListResponse as SchemaListResponse,
    type SchemaListParams as SchemaListParams,
  };

  export { type Settings as Settings };

  export {
    UserSchemas as UserSchemas,
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

  export { ExpressionTemplate as ExpressionTemplate };
}
