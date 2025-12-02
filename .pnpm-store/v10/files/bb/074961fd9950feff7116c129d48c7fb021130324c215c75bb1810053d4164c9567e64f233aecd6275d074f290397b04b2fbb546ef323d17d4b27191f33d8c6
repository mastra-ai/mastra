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
exports.ContentScanning = void 0;
const resource_1 = require("../../resource.js");
const PayloadsAPI = __importStar(require("./payloads.js"));
const payloads_1 = require("./payloads.js");
const SettingsAPI = __importStar(require("./settings.js"));
const settings_1 = require("./settings.js");
class ContentScanning extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.payloads = new PayloadsAPI.Payloads(this._client);
        this.settings = new SettingsAPI.Settings(this._client);
    }
    /**
     * Disable Content Scanning.
     */
    disable(params, options) {
        const { zone_id } = params;
        return this._client.post(`/zones/${zone_id}/content-upload-scan/disable`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Enable Content Scanning.
     */
    enable(params, options) {
        const { zone_id } = params;
        return this._client.post(`/zones/${zone_id}/content-upload-scan/enable`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.ContentScanning = ContentScanning;
ContentScanning.Payloads = payloads_1.Payloads;
ContentScanning.PayloadCreateResponsesSinglePage = payloads_1.PayloadCreateResponsesSinglePage;
ContentScanning.PayloadListResponsesSinglePage = payloads_1.PayloadListResponsesSinglePage;
ContentScanning.PayloadDeleteResponsesSinglePage = payloads_1.PayloadDeleteResponsesSinglePage;
ContentScanning.Settings = settings_1.Settings;
//# sourceMappingURL=content-scanning.js.map