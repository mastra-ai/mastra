// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as ConfigurationsAPI from "./configurations.mjs";
import { Configurations, } from "./configurations.mjs";
import * as SchemasAPI from "./schemas.mjs";
import { Schemas } from "./schemas.mjs";
import * as DiscoveryAPI from "./discovery/discovery.mjs";
import { Discovery, } from "./discovery/discovery.mjs";
import * as ExpressionTemplateAPI from "./expression-template/expression-template.mjs";
import { ExpressionTemplate } from "./expression-template/expression-template.mjs";
import * as OperationsAPI from "./operations/operations.mjs";
import { OperationBulkCreateResponsesSinglePage, OperationListResponsesV4PagePaginationArray, Operations, } from "./operations/operations.mjs";
import * as SettingsAPI from "./settings/settings.mjs";
import * as UserSchemasAPI from "./user-schemas/user-schemas.mjs";
import { PublicSchemasV4PagePaginationArray, UserSchemas, } from "./user-schemas/user-schemas.mjs";
export class APIGateway extends APIResource {
    constructor() {
        super(...arguments);
        this.configurations = new ConfigurationsAPI.Configurations(this._client);
        this.discovery = new DiscoveryAPI.Discovery(this._client);
        this.operations = new OperationsAPI.Operations(this._client);
        this.schemas = new SchemasAPI.Schemas(this._client);
        this.settings = new SettingsAPI.Settings(this._client);
        this.userSchemas = new UserSchemasAPI.UserSchemas(this._client);
        this.expressionTemplate = new ExpressionTemplateAPI.ExpressionTemplate(this._client);
    }
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
//# sourceMappingURL=api-gateway.mjs.map