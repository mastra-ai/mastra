"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingTranscriber = void 0;
const Exports_js_1 = require("../../common.speech/Exports.js");
const Exports_js_2 = require("../../common/Exports.js");
const Contracts_js_1 = require("../Contracts.js");
const Exports_js_3 = require("../Exports.js");
const Exports_js_4 = require("./Exports.js");
class MeetingTranscriber {
    /**
     * MeetingTranscriber constructor.
     * @constructor
     * @param {AudioConfig} audioConfig - An optional audio configuration associated with the recognizer
     */
    constructor(audioConfig) {
        this.privAudioConfig = audioConfig;
        this.privProperties = new Exports_js_3.PropertyCollection();
        this.privRecognizer = undefined;
        this.privDisposedRecognizer = false;
    }
    /**
     * Gets the spoken language of recognition.
     * @member MeetingTranscriber.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @returns {string} The spoken language of recognition.
     */
    get speechRecognitionLanguage() {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedRecognizer);
        return this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage);
    }
    /**
     * The collection of properties and their values defined for this MeetingTranscriber.
     * @member MeetingTranscriber.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The collection of properties and their values defined for this MeetingTranscriber.
     */
    get properties() {
        return this.privProperties;
    }
    /**
     * @Internal
     * Internal data member to support fromRecognizer* pattern methods on other classes.
     * Do not use externally, object returned will change without warning or notice.
     */
    get internalData() {
        return this.privRecognizer.internalData;
    }
    /**
     * @Deprecated
     * @Obsolete
     * Please use the Connection.fromRecognizer pattern to obtain a connection object
     */
    get connection() {
        return Exports_js_3.Connection.fromRecognizer(this.privRecognizer);
    }
    /**
     * Gets the authorization token used to communicate with the service.
     * @member MeetingTranscriber.prototype.authorizationToken
     * @function
     * @public
     * @returns {string} Authorization token.
     */
    get authorizationToken() {
        return this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceAuthorization_Token);
    }
    /**
     * Gets/Sets the authorization token used to communicate with the service.
     * @member MeetingTranscriber.prototype.authorizationToken
     * @function
     * @public
     * @param {string} token - Authorization token.
     */
    set authorizationToken(token) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(token, "token");
        this.properties.setProperty(Exports_js_3.PropertyId.SpeechServiceAuthorization_Token, token);
    }
    /**
     * @param {Meeting} meeting - meeting to be recognized
     */
    joinMeetingAsync(meeting, cb, err) {
        /* eslint-disable no-console */
        // console.log(">> MeetingTranscriber::joinMeetingAsync");
        /* eslint-enable no-console */
        const meetingImpl = meeting;
        Contracts_js_1.Contracts.throwIfNullOrUndefined(Exports_js_4.MeetingImpl, "Meeting");
        // ref the meeting object
        // create recognizer and subscribe to recognizer events
        this.privRecognizer = new Exports_js_1.TranscriberRecognizer(meeting.config, this.privAudioConfig);
        Contracts_js_1.Contracts.throwIfNullOrUndefined(this.privRecognizer, "Recognizer");
        this.privRecognizer.connectMeetingCallbacks(this);
        (0, Exports_js_2.marshalPromiseToCallbacks)(meetingImpl.connectTranscriberRecognizer(this.privRecognizer), cb, err);
    }
    /**
     * Starts meeting transcription, until stopTranscribingAsync() is called.
     * User must subscribe to events to receive transcription results.
     * @member MeetingTranscriber.prototype.startTranscribingAsync
     * @function
     * @public
     * @param cb - Callback invoked once the transcription has started.
     * @param err - Callback invoked in case of an error.
     */
    startTranscribingAsync(cb, err) {
        this.privRecognizer.startContinuousRecognitionAsync(cb, err);
    }
    /**
     * Starts meeting transcription, until stopTranscribingAsync() is called.
     * User must subscribe to events to receive transcription results.
     * @member MeetingTranscriber.prototype.stopTranscribingAsync
     * @function
     * @public
     * @param cb - Callback invoked once the transcription has started.
     * @param err - Callback invoked in case of an error.
     */
    stopTranscribingAsync(cb, err) {
        this.privRecognizer.stopContinuousRecognitionAsync(cb, err);
    }
    /**
     * Leave the current meeting. After this is called, you will no longer receive any events.
     */
    leaveMeetingAsync(cb, err) {
        this.privRecognizer.disconnectCallbacks();
        // eslint-disable-next-line
        (0, Exports_js_2.marshalPromiseToCallbacks)((async () => { return; })(), cb, err);
    }
    /**
     * closes all external resources held by an instance of this class.
     * @member MeetingTranscriber.prototype.close
     * @function
     * @public
     */
    close(cb, errorCb) {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedRecognizer);
        (0, Exports_js_2.marshalPromiseToCallbacks)(this.dispose(true), cb, errorCb);
    }
    /**
     * Disposes any resources held by the object.
     * @member MeetingTranscriber.prototype.dispose
     * @function
     * @public
     * @param {boolean} disposing - true if disposing the object.
     */
    async dispose(disposing) {
        if (this.privDisposedRecognizer) {
            return;
        }
        if (!!this.privRecognizer) {
            await this.privRecognizer.close();
            this.privRecognizer = undefined;
        }
        if (disposing) {
            this.privDisposedRecognizer = true;
        }
    }
}
exports.MeetingTranscriber = MeetingTranscriber;

//# sourceMappingURL=MeetingTranscriber.js.map
