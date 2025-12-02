"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeechDetected = void 0;
class SpeechDetected {
    constructor(json, baseOffset) {
        this.privSpeechStartDetected = JSON.parse(json);
        this.privSpeechStartDetected.Offset += baseOffset;
    }
    static fromJSON(json, baseOffset) {
        return new SpeechDetected(json, baseOffset);
    }
    get Offset() {
        return this.privSpeechStartDetected.Offset;
    }
}
exports.SpeechDetected = SpeechDetected;

//# sourceMappingURL=SpeechDetected.js.map
