"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationSynthesisEnd = void 0;
const Exports_js_1 = require("../Exports.js");
class TranslationSynthesisEnd {
    constructor(json) {
        this.privSynthesisEnd = JSON.parse(json);
        if (!!this.privSynthesisEnd.SynthesisStatus) {
            this.privSynthesisEnd.SynthesisStatus = Exports_js_1.SynthesisStatus[this.privSynthesisEnd.SynthesisStatus];
        }
        if (!!this.privSynthesisEnd.Status) {
            this.privSynthesisEnd.SynthesisStatus = Exports_js_1.SynthesisStatus[this.privSynthesisEnd.Status];
        }
    }
    static fromJSON(json) {
        return new TranslationSynthesisEnd(json);
    }
    get SynthesisStatus() {
        return this.privSynthesisEnd.SynthesisStatus;
    }
    get FailureReason() {
        return this.privSynthesisEnd.FailureReason;
    }
}
exports.TranslationSynthesisEnd = TranslationSynthesisEnd;

//# sourceMappingURL=TranslationSynthesisEnd.js.map
