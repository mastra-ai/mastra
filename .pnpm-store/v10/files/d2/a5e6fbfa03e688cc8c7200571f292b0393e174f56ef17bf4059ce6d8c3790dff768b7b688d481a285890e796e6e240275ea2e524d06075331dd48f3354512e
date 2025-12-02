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
exports.BrandProtection = void 0;
const resource_1 = require("../../resource.js");
const LogoMatchesAPI = __importStar(require("./logo-matches.js"));
const logo_matches_1 = require("./logo-matches.js");
const LogosAPI = __importStar(require("./logos.js"));
const logos_1 = require("./logos.js");
const MatchesAPI = __importStar(require("./matches.js"));
const matches_1 = require("./matches.js");
const QueriesAPI = __importStar(require("./queries.js"));
const queries_1 = require("./queries.js");
class BrandProtection extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.queries = new QueriesAPI.Queries(this._client);
        this.matches = new MatchesAPI.Matches(this._client);
        this.logos = new LogosAPI.Logos(this._client);
        this.logoMatches = new LogoMatchesAPI.LogoMatches(this._client);
    }
    /**
     * Submit suspicious URL for scanning.
     *
     * @example
     * ```ts
     * const submit = await client.brandProtection.submit({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    submit(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/brand-protection/submit`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Gets phishing details about a URL.
     *
     * @example
     * ```ts
     * const info = await client.brandProtection.urlInfo({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    urlInfo(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/brand-protection/url-info`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.BrandProtection = BrandProtection;
BrandProtection.Queries = queries_1.Queries;
BrandProtection.Matches = matches_1.Matches;
BrandProtection.Logos = logos_1.Logos;
BrandProtection.LogoMatches = logo_matches_1.LogoMatches;
//# sourceMappingURL=brand-protection.js.map