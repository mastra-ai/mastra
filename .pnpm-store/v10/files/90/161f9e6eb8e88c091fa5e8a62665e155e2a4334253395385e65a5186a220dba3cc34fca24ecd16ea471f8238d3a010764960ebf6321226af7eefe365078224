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
exports.HyperdrivesSinglePage = exports.HyperdriveResource = void 0;
const resource_1 = require("../../resource.js");
const ConfigsAPI = __importStar(require("./configs.js"));
const configs_1 = require("./configs.js");
const pagination_1 = require("../../pagination.js");
class HyperdriveResource extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.configs = new ConfigsAPI.Configs(this._client);
    }
}
exports.HyperdriveResource = HyperdriveResource;
class HyperdrivesSinglePage extends pagination_1.SinglePage {
}
exports.HyperdrivesSinglePage = HyperdrivesSinglePage;
HyperdriveResource.Configs = configs_1.Configs;
//# sourceMappingURL=hyperdrive.js.map