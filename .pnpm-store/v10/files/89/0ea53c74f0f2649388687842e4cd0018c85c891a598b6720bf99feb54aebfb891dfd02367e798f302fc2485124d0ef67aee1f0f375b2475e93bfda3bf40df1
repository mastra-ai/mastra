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
exports.ModelListResponsesV4PagePaginationArray = exports.Models = void 0;
const resource_1 = require("../../../resource.js");
const SchemaAPI = __importStar(require("./schema.js"));
const schema_1 = require("./schema.js");
const pagination_1 = require("../../../pagination.js");
class Models extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.schema = new SchemaAPI.Schema(this._client);
    }
    /**
     * Model Search
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/ai/models/search`, ModelListResponsesV4PagePaginationArray, { query, ...options });
    }
}
exports.Models = Models;
class ModelListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.ModelListResponsesV4PagePaginationArray = ModelListResponsesV4PagePaginationArray;
Models.ModelListResponsesV4PagePaginationArray = ModelListResponsesV4PagePaginationArray;
Models.Schema = schema_1.Schema;
//# sourceMappingURL=models.js.map