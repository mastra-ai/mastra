"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialogServiceTurnState = void 0;
const AudioOutputFormat_js_1 = require("../sdk/Audio/AudioOutputFormat.js");
const AudioOutputStream_js_1 = require("../sdk/Audio/AudioOutputStream.js");
const ActivityResponsePayload_js_1 = require("./ServiceMessages/ActivityResponsePayload.js");
class DialogServiceTurnState {
    constructor(manager, requestId) {
        this.privRequestId = requestId;
        this.privIsCompleted = false;
        this.privAudioStream = null;
        this.privTurnManager = manager;
        this.resetTurnEndTimeout();
    }
    get audioStream() {
        // Called when is needed to stream.
        this.resetTurnEndTimeout();
        return this.privAudioStream;
    }
    processActivityPayload(payload, audioFormat) {
        if (payload.messageDataStreamType === ActivityResponsePayload_js_1.MessageDataStreamType.TextToSpeechAudio) {
            this.privAudioStream = AudioOutputStream_js_1.AudioOutputStream.createPullStream();
            this.privAudioStream.format = (audioFormat !== undefined) ? audioFormat : AudioOutputFormat_js_1.AudioOutputFormatImpl.getDefaultOutputFormat();
        }
        return this.privAudioStream;
    }
    endAudioStream() {
        if (this.privAudioStream !== null && !this.privAudioStream.isClosed) {
            this.privAudioStream.close();
        }
    }
    complete() {
        if (this.privTimeoutToken !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            clearTimeout(this.privTimeoutToken);
        }
        this.endAudioStream();
    }
    resetTurnEndTimeout() {
        if (this.privTimeoutToken !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            clearTimeout(this.privTimeoutToken);
        }
        this.privTimeoutToken = setTimeout(() => {
            this.privTurnManager.CompleteTurn(this.privRequestId);
            return;
        }, 2000);
    }
}
exports.DialogServiceTurnState = DialogServiceTurnState;

//# sourceMappingURL=DialogServiceTurnState.js.map
