"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationRequestSession = void 0;
const Exports_js_1 = require("../../common/Exports.js");
/**
 * Placeholder class for the Conversation Request Session. Based off RequestSession.
 * TODO: define what telemetry is required.
 */
class ConversationRequestSession {
    constructor(sessionId) {
        this.privIsDisposed = false;
        this.privDetachables = new Array();
        this.privSessionId = sessionId;
        this.privRequestId = (0, Exports_js_1.createNoDashGuid)();
        this.privRequestCompletionDeferral = new Exports_js_1.Deferred();
    }
    get sessionId() {
        return this.privSessionId;
    }
    get requestId() {
        return this.privRequestId;
    }
    get completionPromise() {
        return this.privRequestCompletionDeferral.promise;
    }
    onPreConnectionStart(authFetchEventId, connectionId) {
        this.privSessionId = connectionId;
    }
    onAuthCompleted(isError) {
        if (isError) {
            this.onComplete();
        }
    }
    onConnectionEstablishCompleted(statusCode) {
        if (statusCode === 200) {
            return;
        }
        else if (statusCode === 403) {
            this.onComplete();
        }
    }
    onServiceTurnEndResponse(continuousRecognition) {
        if (!continuousRecognition) {
            this.onComplete();
        }
        else {
            this.privRequestId = (0, Exports_js_1.createNoDashGuid)();
        }
    }
    async dispose() {
        if (!this.privIsDisposed) {
            // we should have completed by now. If we did not its an unknown error.
            this.privIsDisposed = true;
            for (const detachable of this.privDetachables) {
                await detachable.detach();
            }
        }
    }
    onComplete() {
        //
    }
}
exports.ConversationRequestSession = ConversationRequestSession;

//# sourceMappingURL=ConversationRequestSession.js.map
