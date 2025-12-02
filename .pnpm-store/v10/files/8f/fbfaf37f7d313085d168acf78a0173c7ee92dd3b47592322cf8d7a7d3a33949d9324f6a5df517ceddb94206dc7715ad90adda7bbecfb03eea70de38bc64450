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
exports.Control = void 0;
const resource_1 = require("../../../resource.js");
const RetentionAPI = __importStar(require("./retention.js"));
const retention_1 = require("./retention.js");
const CmbAPI = __importStar(require("./cmb/cmb.js"));
const cmb_1 = require("./cmb/cmb.js");
class Control extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.retention = new RetentionAPI.Retention(this._client);
        this.cmb = new CmbAPI.Cmb(this._client);
    }
}
exports.Control = Control;
Control.Retention = retention_1.Retention;
Control.Cmb = cmb_1.Cmb;
//# sourceMappingURL=control.js.map