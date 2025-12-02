"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeechKeyword = void 0;
class SpeechKeyword {
    constructor(json, baseOffset) {
        this.privSpeechKeyword = JSON.parse(json);
        this.privSpeechKeyword.Offset += baseOffset;
    }
    static fromJSON(json, baseOffset) {
        return new SpeechKeyword(json, baseOffset);
    }
    get Status() {
        return this.privSpeechKeyword.Status;
    }
    get Text() {
        return this.privSpeechKeyword.Text;
    }
    get Offset() {
        return this.privSpeechKeyword.Offset;
    }
    get Duration() {
        return this.privSpeechKeyword.Duration;
    }
    asJson() {
        return JSON.stringify(this.privSpeechKeyword);
    }
}
exports.SpeechKeyword = SpeechKeyword;

//# sourceMappingURL=SpeechKeyword.js.map
