"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeechSynthesisAdapter = void 0;
const Exports_js_1 = require("../sdk/Exports.js");
const Exports_js_2 = require("./Exports.js");
class SpeechSynthesisAdapter extends Exports_js_2.SynthesisAdapterBase {
    constructor(authentication, connectionFactory, synthesizerConfig, speechSynthesizer, audioDestination) {
        super(authentication, connectionFactory, synthesizerConfig, audioDestination);
        this.privSpeechSynthesizer = speechSynthesizer;
        this.privSynthesizer = speechSynthesizer;
    }
    setSynthesisContextSynthesisSection() {
        this.privSynthesisContext.setSynthesisSection(this.privSpeechSynthesizer);
    }
    onSynthesisStarted(requestId) {
        const synthesisStartEventArgs = new Exports_js_1.SpeechSynthesisEventArgs(new Exports_js_1.SpeechSynthesisResult(requestId, Exports_js_1.ResultReason.SynthesizingAudioStarted));
        if (!!this.privSpeechSynthesizer.synthesisStarted) {
            this.privSpeechSynthesizer.synthesisStarted(this.privSpeechSynthesizer, synthesisStartEventArgs);
        }
    }
    onSynthesizing(audio) {
        if (!!this.privSpeechSynthesizer.synthesizing) {
            try {
                const audioWithHeader = this.privSynthesisTurn.audioOutputFormat.addHeader(audio);
                const ev = new Exports_js_1.SpeechSynthesisEventArgs(new Exports_js_1.SpeechSynthesisResult(this.privSynthesisTurn.requestId, Exports_js_1.ResultReason.SynthesizingAudio, audioWithHeader));
                this.privSpeechSynthesizer.synthesizing(this.privSpeechSynthesizer, ev);
            }
            catch (error) {
                // Not going to let errors in the event handler
                // trip things up.
            }
        }
    }
    onSynthesisCancelled(result) {
        if (!!this.privSpeechSynthesizer.SynthesisCanceled) {
            const cancelEvent = new Exports_js_1.SpeechSynthesisEventArgs(result);
            try {
                this.privSpeechSynthesizer.SynthesisCanceled(this.privSpeechSynthesizer, cancelEvent);
                /* eslint-disable no-empty */
            }
            catch { }
        }
    }
    onSynthesisCompleted(result) {
        if (this.privSpeechSynthesizer.synthesisCompleted) {
            try {
                this.privSpeechSynthesizer.synthesisCompleted(this.privSpeechSynthesizer, new Exports_js_1.SpeechSynthesisEventArgs(result));
            }
            catch (e) {
                // Not going to let errors in the event handler
                // trip things up.
            }
        }
    }
    onWordBoundary(wordBoundaryEventArgs) {
        if (!!this.privSpeechSynthesizer.wordBoundary) {
            try {
                this.privSpeechSynthesizer.wordBoundary(this.privSpeechSynthesizer, wordBoundaryEventArgs);
            }
            catch (error) {
                // Not going to let errors in the event handler
                // trip things up.
            }
        }
    }
    onVisemeReceived(visemeEventArgs) {
        if (!!this.privSpeechSynthesizer.visemeReceived) {
            try {
                this.privSpeechSynthesizer.visemeReceived(this.privSpeechSynthesizer, visemeEventArgs);
            }
            catch (error) {
                // Not going to let errors in the event handler
                // trip things up.
            }
        }
    }
    onBookmarkReached(bookmarkEventArgs) {
        if (!!this.privSpeechSynthesizer.bookmarkReached) {
            try {
                this.privSpeechSynthesizer.bookmarkReached(this.privSpeechSynthesizer, bookmarkEventArgs);
            }
            catch (error) {
                // Not going to let errors in the event handler
                // trip things up.
            }
        }
    }
}
exports.SpeechSynthesisAdapter = SpeechSynthesisAdapter;

//# sourceMappingURL=SpeechSynthesisAdapter.js.map
