"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SynthesizerConfig = exports.SynthesisServiceType = void 0;
const Exports_js_1 = require("./Exports.js");
var SynthesisServiceType;
(function (SynthesisServiceType) {
    SynthesisServiceType[SynthesisServiceType["Standard"] = 0] = "Standard";
    SynthesisServiceType[SynthesisServiceType["Custom"] = 1] = "Custom";
})(SynthesisServiceType = exports.SynthesisServiceType || (exports.SynthesisServiceType = {}));
class SynthesizerConfig {
    constructor(speechServiceConfig, parameters) {
        this.privSynthesisServiceType = SynthesisServiceType.Standard;
        this.avatarEnabled = false;
        this.privSpeechServiceConfig = speechServiceConfig ? speechServiceConfig : new Exports_js_1.SpeechServiceConfig(new Exports_js_1.Context(null));
        this.privParameters = parameters;
    }
    get parameters() {
        return this.privParameters;
    }
    get synthesisServiceType() {
        return this.privSynthesisServiceType;
    }
    set synthesisServiceType(value) {
        this.privSynthesisServiceType = value;
    }
    set synthesisVideoSection(value) {
        this.privSpeechServiceConfig.Context.synthesis = {
            video: value
        };
    }
    get SpeechServiceConfig() {
        return this.privSpeechServiceConfig;
    }
    setContextFromJson(contextJson) {
        const context = JSON.parse(contextJson);
        if (context.system) {
            this.privSpeechServiceConfig.Context.system = context.system;
        }
        if (context.os) {
            this.privSpeechServiceConfig.Context.os = context.os;
        }
        if (context.audio) {
            this.privSpeechServiceConfig.Context.audio = context.audio;
        }
        if (context.synthesis) {
            this.privSpeechServiceConfig.Context.synthesis = context.synthesis;
        }
    }
}
exports.SynthesizerConfig = SynthesizerConfig;

//# sourceMappingURL=SynthesizerConfig.js.map
