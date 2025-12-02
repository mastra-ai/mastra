"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecognizerConfig = exports.SpeechResultFormat = void 0;
/* eslint-disable max-classes-per-file */
const Exports_js_1 = require("../sdk/Exports.js");
const Exports_js_2 = require("./Exports.js");
const PhraseDetectionContext_js_1 = require("./ServiceMessages/PhraseDetection/PhraseDetectionContext.js");
var SpeechResultFormat;
(function (SpeechResultFormat) {
    SpeechResultFormat[SpeechResultFormat["Simple"] = 0] = "Simple";
    SpeechResultFormat[SpeechResultFormat["Detailed"] = 1] = "Detailed";
})(SpeechResultFormat = exports.SpeechResultFormat || (exports.SpeechResultFormat = {}));
class RecognizerConfig {
    constructor(speechServiceConfig, parameters) {
        this.privSpeechServiceConfig = speechServiceConfig ? speechServiceConfig : new Exports_js_2.SpeechServiceConfig(new Exports_js_2.Context(null));
        this.privParameters = parameters;
        this.privMaxRetryCount = parseInt(parameters.getProperty("SPEECH-Error-MaxRetryCount", "4"), 10);
        this.privLanguageIdMode = parameters.getProperty(Exports_js_1.PropertyId.SpeechServiceConnection_LanguageIdMode, undefined);
        this.privEnableSpeakerId = false;
    }
    get parameters() {
        return this.privParameters;
    }
    get recognitionMode() {
        return this.privRecognitionMode;
    }
    set recognitionMode(value) {
        this.privRecognitionMode = value;
        this.privRecognitionActivityTimeout = value === PhraseDetectionContext_js_1.RecognitionMode.Interactive ? 8000 : 25000;
        this.privSpeechServiceConfig.Recognition = PhraseDetectionContext_js_1.RecognitionMode[value];
    }
    get SpeechServiceConfig() {
        return this.privSpeechServiceConfig;
    }
    get recognitionActivityTimeout() {
        return this.privRecognitionActivityTimeout;
    }
    get isContinuousRecognition() {
        return this.privRecognitionMode !== PhraseDetectionContext_js_1.RecognitionMode.Interactive;
    }
    get languageIdMode() {
        return this.privLanguageIdMode;
    }
    get autoDetectSourceLanguages() {
        return this.parameters.getProperty(Exports_js_1.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguages, undefined);
    }
    get recognitionEndpointVersion() {
        return this.parameters.getProperty(Exports_js_1.PropertyId.SpeechServiceConnection_RecognitionEndpointVersion, "2");
    }
    set recognitionEndpointVersion(version) {
        this.parameters.setProperty(Exports_js_1.PropertyId.SpeechServiceConnection_RecognitionEndpointVersion, version);
    }
    get sourceLanguageModels() {
        const models = [];
        let modelsExist = false;
        if (this.autoDetectSourceLanguages !== undefined) {
            for (const language of this.autoDetectSourceLanguages.split(",")) {
                const customProperty = language + Exports_js_1.PropertyId.SpeechServiceConnection_EndpointId.toString();
                const modelId = this.parameters.getProperty(customProperty, undefined);
                if (modelId !== undefined) {
                    models.push({ language, endpoint: modelId });
                    modelsExist = true;
                }
                else {
                    models.push({ language, endpoint: "" });
                }
            }
        }
        return modelsExist ? models : undefined;
    }
    get maxRetryCount() {
        return this.privMaxRetryCount;
    }
    get isSpeakerDiarizationEnabled() {
        return this.privEnableSpeakerId;
    }
    set isSpeakerDiarizationEnabled(value) {
        this.privEnableSpeakerId = value;
    }
}
exports.RecognizerConfig = RecognizerConfig;

//# sourceMappingURL=RecognizerConfig.js.map
