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
exports.R2 = void 0;
const resource_1 = require("../../resource.js");
const TemporaryCredentialsAPI = __importStar(require("./temporary-credentials.js"));
const temporary_credentials_1 = require("./temporary-credentials.js");
const BucketsAPI = __importStar(require("./buckets/buckets.js"));
const buckets_1 = require("./buckets/buckets.js");
const SuperSlurperAPI = __importStar(require("./super-slurper/super-slurper.js"));
const super_slurper_1 = require("./super-slurper/super-slurper.js");
class R2 extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.buckets = new BucketsAPI.Buckets(this._client);
        this.temporaryCredentials = new TemporaryCredentialsAPI.TemporaryCredentials(this._client);
        this.superSlurper = new SuperSlurperAPI.SuperSlurper(this._client);
    }
}
exports.R2 = R2;
R2.Buckets = buckets_1.Buckets;
R2.TemporaryCredentials = temporary_credentials_1.TemporaryCredentials;
R2.SuperSlurper = super_slurper_1.SuperSlurper;
//# sourceMappingURL=r2.js.map