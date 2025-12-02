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
exports.CaptionsSinglePage = exports.Captions = void 0;
const resource_1 = require("../../../resource.js");
const LanguageAPI = __importStar(require("./language/language.js"));
const language_1 = require("./language/language.js");
const pagination_1 = require("../../../pagination.js");
class Captions extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.language = new LanguageAPI.Language(this._client);
    }
    /**
     * Lists the available captions or subtitles for a specific video.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const caption of client.stream.captions.get(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(identifier, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/stream/${identifier}/captions`, CaptionsSinglePage, options);
    }
}
exports.Captions = Captions;
class CaptionsSinglePage extends pagination_1.SinglePage {
}
exports.CaptionsSinglePage = CaptionsSinglePage;
Captions.CaptionsSinglePage = CaptionsSinglePage;
Captions.Language = language_1.Language;
//# sourceMappingURL=captions.js.map