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
exports.Domains = void 0;
const resource_1 = require("../../../../resource.js");
const CustomAPI = __importStar(require("./custom.js"));
const custom_1 = require("./custom.js");
const ManagedAPI = __importStar(require("./managed.js"));
const managed_1 = require("./managed.js");
class Domains extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.custom = new CustomAPI.Custom(this._client);
        this.managed = new ManagedAPI.Managed(this._client);
    }
}
exports.Domains = Domains;
Domains.Custom = custom_1.Custom;
Domains.Managed = managed_1.Managed;
//# sourceMappingURL=domains.js.map