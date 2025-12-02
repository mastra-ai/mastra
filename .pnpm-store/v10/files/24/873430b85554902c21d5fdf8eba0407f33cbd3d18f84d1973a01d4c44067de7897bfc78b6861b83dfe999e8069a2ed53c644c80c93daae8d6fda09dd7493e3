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
exports.Images = void 0;
const resource_1 = require("../../resource.js");
const V1API = __importStar(require("./v1/v1.js"));
const v1_1 = require("./v1/v1.js");
const V2API = __importStar(require("./v2/v2.js"));
const v2_1 = require("./v2/v2.js");
class Images extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.v1 = new V1API.V1(this._client);
        this.v2 = new V2API.V2(this._client);
    }
}
exports.Images = Images;
Images.V1 = v1_1.V1;
Images.V1ListResponsesV4PagePagination = v1_1.V1ListResponsesV4PagePagination;
Images.V2 = v2_1.V2;
//# sourceMappingURL=images.js.map