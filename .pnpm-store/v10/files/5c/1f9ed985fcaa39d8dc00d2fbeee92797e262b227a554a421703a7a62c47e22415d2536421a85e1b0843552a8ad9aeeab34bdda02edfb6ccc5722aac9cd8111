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
exports.SSL = void 0;
const resource_1 = require("../../resource.js");
const AnalyzeAPI = __importStar(require("./analyze.js"));
const analyze_1 = require("./analyze.js");
const RecommendationsAPI = __importStar(require("./recommendations.js"));
const recommendations_1 = require("./recommendations.js");
const VerificationAPI = __importStar(require("./verification.js"));
const verification_1 = require("./verification.js");
const CertificatePacksAPI = __importStar(require("./certificate-packs/certificate-packs.js"));
const certificate_packs_1 = require("./certificate-packs/certificate-packs.js");
const UniversalAPI = __importStar(require("./universal/universal.js"));
const universal_1 = require("./universal/universal.js");
class SSL extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.analyze = new AnalyzeAPI.Analyze(this._client);
        this.certificatePacks = new CertificatePacksAPI.CertificatePacks(this._client);
        this.recommendations = new RecommendationsAPI.Recommendations(this._client);
        this.universal = new UniversalAPI.Universal(this._client);
        this.verification = new VerificationAPI.VerificationResource(this._client);
    }
}
exports.SSL = SSL;
SSL.Analyze = analyze_1.Analyze;
SSL.CertificatePacks = certificate_packs_1.CertificatePacks;
SSL.CertificatePackListResponsesSinglePage = certificate_packs_1.CertificatePackListResponsesSinglePage;
SSL.Recommendations = recommendations_1.Recommendations;
SSL.Universal = universal_1.Universal;
SSL.VerificationResource = verification_1.VerificationResource;
//# sourceMappingURL=ssl.js.map