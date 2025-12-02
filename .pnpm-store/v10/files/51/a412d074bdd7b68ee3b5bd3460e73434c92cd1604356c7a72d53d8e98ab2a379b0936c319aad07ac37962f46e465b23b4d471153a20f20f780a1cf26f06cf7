"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceLanguageConfig = void 0;
const Contracts_js_1 = require("./Contracts.js");
/**
 * Source Language configuration.
 * @class SourceLanguageConfig
 */
class SourceLanguageConfig {
    constructor(language, endpointId) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(language, "language");
        this.privLanguage = language;
        this.privEndpointId = endpointId;
    }
    /**
     * @member SourceLanguageConfig.fromLanguage
     * @function
     * @public
     * @param {string} language language (eg. "en-US") value of config.
     * @param {string?} endpointId endpointId of model bound to given language of config.
     * @return {SourceLanguageConfig} Instance of SourceLanguageConfig
     * @summary Creates an instance of the SourceLanguageConfig with the given language and optional endpointId.
     * Added in version 1.13.0.
     */
    static fromLanguage(language, endpointId) {
        return new SourceLanguageConfig(language, endpointId);
    }
    get language() {
        return this.privLanguage;
    }
    get endpointId() {
        return this.privEndpointId;
    }
}
exports.SourceLanguageConfig = SourceLanguageConfig;

//# sourceMappingURL=SourceLanguageConfig.js.map
