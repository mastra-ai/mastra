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
exports.Speed = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
const TopAPI = __importStar(require("./top.js"));
const top_1 = require("./top.js");
class Speed extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.top = new TopAPI.Top(this._client);
    }
    histogram(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.histogram({}, query);
        }
        return this._client.get('/radar/quality/speed/histogram', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    summary(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.summary({}, query);
        }
        return this._client.get('/radar/quality/speed/summary', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Speed = Speed;
Speed.Top = top_1.Top;
//# sourceMappingURL=speed.js.map