"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriptionServiceRecognizer = void 0;
const Exports_js_1 = require("../common/Exports.js");
const Exports_js_2 = require("../sdk/Exports.js");
const Exports_js_3 = require("./Exports.js");
const SpeechConnectionMessage_Internal_js_1 = require("./SpeechConnectionMessage.Internal.js");
// eslint-disable-next-line max-classes-per-file
class TranscriptionServiceRecognizer extends Exports_js_3.ConversationServiceRecognizer {
    constructor(authentication, connectionFactory, audioSource, recognizerConfig, transcriber) {
        super(authentication, connectionFactory, audioSource, recognizerConfig, transcriber);
        this.privTranscriberRecognizer = transcriber;
        this.sendPrePayloadJSONOverride = (connection) => this.sendTranscriptionStartJSON(connection);
        if (this.privRecognizerConfig.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceResponse_RequestWordLevelTimestamps) === "true") {
            this.privSpeechContext.setWordLevelTimings();
        }
    }
    async sendSpeechEventAsync(info, command) {
        if (!!this.privRequestSession.isRecognizing) {
            const connection = await this.fetchConnection();
            await this.sendSpeechEvent(connection, this.createSpeechEventPayload(info, command));
        }
    }
    async sendMeetingSpeechEventAsync(info, command) {
        if (!!this.privRequestSession.isRecognizing) {
            const connection = await this.fetchConnection();
            await this.sendSpeechEvent(connection, this.createMeetingSpeechEventPayload(info, command));
        }
    }
    processTypeSpecificMessages(connectionMessage) {
        return this.processSpeechMessages(connectionMessage);
    }
    handleRecognizedCallback(result, offset, sessionId) {
        try {
            const event = new Exports_js_2.SpeechRecognitionEventArgs(result, offset, sessionId);
            this.privTranscriberRecognizer.recognized(this.privTranscriberRecognizer, event);
            if (!!this.privSuccessCallback) {
                try {
                    this.privSuccessCallback(result);
                }
                catch (e) {
                    if (!!this.privErrorCallback) {
                        this.privErrorCallback(e);
                    }
                }
                // Only invoke the call back once.
                // and if it's successful don't invoke the
                // error after that.
                this.privSuccessCallback = undefined;
                this.privErrorCallback = undefined;
            }
            /* eslint-disable no-empty */
        }
        catch (error) {
            // Not going to let errors in the event handler
            // trip things up.
        }
    }
    handleRecognizingCallback(result, duration, sessionId) {
        try {
            const ev = new Exports_js_2.SpeechRecognitionEventArgs(result, duration, sessionId);
            this.privTranscriberRecognizer.recognizing(this.privTranscriberRecognizer, ev);
            /* eslint-disable no-empty */
        }
        catch (error) {
            // Not going to let errors in the event handler
            // trip things up.
        }
    }
    // Cancels recognition.
    cancelRecognition(sessionId, requestId, cancellationReason, errorCode, error) {
        const properties = new Exports_js_2.PropertyCollection();
        properties.setProperty(Exports_js_3.CancellationErrorCodePropertyName, Exports_js_2.CancellationErrorCode[errorCode]);
        if (this.privTranscriberRecognizer.IsMeetingRecognizer()) {
            if (!!this.privTranscriberRecognizer.canceled) {
                const cancelEvent = new Exports_js_2.MeetingTranscriptionCanceledEventArgs(cancellationReason, error, errorCode, undefined, sessionId);
                try {
                    this.privTranscriberRecognizer.canceled(this.privTranscriberRecognizer, cancelEvent);
                    /* eslint-disable no-empty */
                }
                catch { }
            }
        }
        else {
            if (!!this.privTranscriberRecognizer.canceled) {
                const cancelEvent = new Exports_js_2.ConversationTranscriptionCanceledEventArgs(cancellationReason, error, errorCode, undefined, sessionId);
                try {
                    this.privTranscriberRecognizer.canceled(this.privTranscriberRecognizer, cancelEvent);
                    /* eslint-disable no-empty */
                }
                catch { }
            }
        }
        if (!!this.privSuccessCallback) {
            const result = new Exports_js_2.SpeechRecognitionResult(requestId, Exports_js_2.ResultReason.Canceled, undefined, // Text
            undefined, // Duration
            undefined, // Offset
            undefined, // Language
            undefined, // Language Detection Confidence
            undefined, // Speaker Id
            error, undefined, // Json
            properties);
            try {
                this.privSuccessCallback(result);
                this.privSuccessCallback = undefined;
                /* eslint-disable no-empty */
            }
            catch { }
        }
    }
    // Encapsulated for derived service recognizers that need to send additional JSON
    async sendTranscriptionStartJSON(connection) {
        await this.sendSpeechContext(connection, true);
        if (this.privTranscriberRecognizer.IsMeetingRecognizer()) {
            const info = this.privTranscriberRecognizer.getMeetingInfo();
            const payload = this.createMeetingSpeechEventPayload(info, "start");
            await this.sendSpeechEvent(connection, payload);
        }
        else {
            const info = this.privTranscriberRecognizer.getConversationInfo();
            const payload = this.createSpeechEventPayload(info, "start");
            await this.sendSpeechEvent(connection, payload);
        }
        await this.sendWaveHeader(connection);
        return;
    }
    sendSpeechEvent(connection, payload) {
        const speechEventJson = JSON.stringify(payload);
        if (speechEventJson) {
            return connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_1.MessageType.Text, "speech.event", this.privRequestSession.requestId, "application/json", speechEventJson));
        }
        return;
    }
    createSpeechEventPayload(info, command) {
        const eventDict = { id: "meeting", name: command, meeting: info.conversationProperties };
        eventDict.meeting.id = info.id;
        eventDict.meeting.attendees = info.participants;
        return eventDict;
    }
    createMeetingSpeechEventPayload(info, command) {
        const eventDict = { id: "meeting", name: command, meeting: info.meetingProperties };
        eventDict.meeting.id = info.id;
        eventDict.meeting.attendees = info.participants;
        return eventDict;
    }
}
exports.TranscriptionServiceRecognizer = TranscriptionServiceRecognizer;

//# sourceMappingURL=TranscriptionServiceRecognizer.js.map
