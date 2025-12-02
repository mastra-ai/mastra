"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationCommon = void 0;
class ConversationCommon {
    constructor(audioConfig) {
        this.privAudioConfig = audioConfig;
    }
    handleCallback(cb, err) {
        if (!!cb) {
            try {
                cb();
            }
            catch (e) {
                if (!!err) {
                    err(e);
                }
            }
            cb = undefined;
        }
    }
    handleError(error, err) {
        if (!!err) {
            if (error instanceof Error) {
                const typedError = error;
                err(typedError.name + ": " + typedError.message);
            }
            else {
                err(error);
            }
        }
    }
}
exports.ConversationCommon = ConversationCommon;

//# sourceMappingURL=ConversationCommon.js.map
