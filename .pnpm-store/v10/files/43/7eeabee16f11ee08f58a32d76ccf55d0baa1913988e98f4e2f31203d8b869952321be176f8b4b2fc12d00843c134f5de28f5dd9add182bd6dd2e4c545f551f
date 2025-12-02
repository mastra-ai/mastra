"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIGateway = void 0;
const resource_1 = require("../../resource.js");
const ConfigurationsAPI = __importStar(require("./configurations.js"));
const configurations_1 = require("./configurations.js");
const SchemasAPI = __importStar(require("./schemas.js"));
const schemas_1 = require("./schemas.js");
const DiscoveryAPI = __importStar(require("./discovery/discovery.js"));
const discovery_1 = require("./discovery/discovery.js");
const ExpressionTemplateAPI = __importStar(require("./expression-template/expression-template.js"));
const expression_template_1 = require("./expression-template/expression-template.js");
const OperationsAPI = __importStar(require("./operations/operations.js"));
const operations_1 = require("./operations/operations.js");
const SettingsAPI = __importStar(require("./settings/settings.js"));
const UserSchemasAPI = __importStar(require("./user-schemas/user-schemas.js"));
const user_schemas_1 = require("./user-schemas/user-schemas.js");
class APIGateway extends resource_1.APIResource {
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
exports.APIGateway = APIGateway;
APIGateway.Configurations = configurations_1.Configurations;
APIGateway.Discovery = discovery_1.Discovery;
APIGateway.Operations = operations_1.Operations;
APIGateway.OperationListResponsesV4PagePaginationArray = operations_1.OperationListResponsesV4PagePaginationArray;
APIGateway.OperationBulkCreateResponsesSinglePage = operations_1.OperationBulkCreateResponsesSinglePage;
APIGateway.Schemas = schemas_1.Schemas;
APIGateway.UserSchemas = user_schemas_1.UserSchemas;
APIGateway.PublicSchemasV4PagePaginationArray = user_schemas_1.PublicSchemasV4PagePaginationArray;
APIGateway.ExpressionTemplate = expression_template_1.ExpressionTemplate;
//# sourceMappingURL=api-gateway.js.map