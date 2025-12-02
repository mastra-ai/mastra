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
exports.Attacks = void 0;
const resource_1 = require("../../../resource.js");
const Layer3API = __importStar(require("./layer3/layer3.js"));
const layer3_1 = require("./layer3/layer3.js");
const Layer7API = __importStar(require("./layer7/layer7.js"));
const layer7_1 = require("./layer7/layer7.js");
class Attacks extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.layer3 = new Layer3API.Layer3(this._client);
        this.layer7 = new Layer7API.Layer7(this._client);
    }
}
exports.Attacks = Attacks;
Attacks.Layer3 = layer3_1.Layer3;
Attacks.Layer7 = layer7_1.Layer7;
//# sourceMappingURL=attacks.js.map