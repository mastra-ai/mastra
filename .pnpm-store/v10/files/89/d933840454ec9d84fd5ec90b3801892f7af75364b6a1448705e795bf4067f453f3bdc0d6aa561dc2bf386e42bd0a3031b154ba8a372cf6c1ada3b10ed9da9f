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
exports.Finetunes = void 0;
const resource_1 = require("../../../resource.js");
const AssetsAPI = __importStar(require("./assets.js"));
const assets_1 = require("./assets.js");
const PublicAPI = __importStar(require("./public.js"));
const public_1 = require("./public.js");
class Finetunes extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.assets = new AssetsAPI.Assets(this._client);
        this.public = new PublicAPI.Public(this._client);
    }
    /**
     * Create a new Finetune
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/ai/finetunes`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List Finetunes
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/ai/finetunes`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Finetunes = Finetunes;
Finetunes.Assets = assets_1.Assets;
Finetunes.Public = public_1.Public;
Finetunes.PublicListResponsesSinglePage = public_1.PublicListResponsesSinglePage;
//# sourceMappingURL=finetunes.js.map