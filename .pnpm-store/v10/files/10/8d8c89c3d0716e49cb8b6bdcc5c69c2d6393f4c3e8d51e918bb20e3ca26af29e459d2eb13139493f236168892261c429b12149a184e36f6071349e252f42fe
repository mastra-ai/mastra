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
exports.NamespacesSinglePage = exports.Namespaces = void 0;
const resource_1 = require("../../../resource.js");
const ObjectsAPI = __importStar(require("./objects.js"));
const objects_1 = require("./objects.js");
const pagination_1 = require("../../../pagination.js");
class Namespaces extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.objects = new ObjectsAPI.Objects(this._client);
    }
    /**
     * Returns the Durable Object namespaces owned by an account.
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workers/durable_objects/namespaces`, NamespacesSinglePage, options);
    }
}
exports.Namespaces = Namespaces;
class NamespacesSinglePage extends pagination_1.SinglePage {
}
exports.NamespacesSinglePage = NamespacesSinglePage;
Namespaces.NamespacesSinglePage = NamespacesSinglePage;
Namespaces.Objects = objects_1.Objects;
Namespaces.DurableObjectsCursorLimitPagination = objects_1.DurableObjectsCursorLimitPagination;
//# sourceMappingURL=namespaces.js.map