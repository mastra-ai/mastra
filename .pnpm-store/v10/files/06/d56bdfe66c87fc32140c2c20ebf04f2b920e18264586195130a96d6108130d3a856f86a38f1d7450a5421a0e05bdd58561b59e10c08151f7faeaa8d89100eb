"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionRedirectEvent = exports.ConnectionMessageSentEvent = exports.ConnectionMessageReceivedEvent = exports.ConnectionEstablishErrorEvent = exports.ConnectionErrorEvent = exports.ConnectionClosedEvent = exports.ConnectionEstablishedEvent = exports.ConnectionStartEvent = exports.ConnectionEvent = exports.ServiceEvent = void 0;
const PlatformEvent_js_1 = require("./PlatformEvent.js");
class ServiceEvent extends PlatformEvent_js_1.PlatformEvent {
    constructor(eventName, jsonstring, eventType = PlatformEvent_js_1.EventType.Info) {
        super(eventName, eventType);
        this.privJsonResult = jsonstring;
    }
    get jsonString() {
        return this.privJsonResult;
    }
}
exports.ServiceEvent = ServiceEvent;
class ConnectionEvent extends PlatformEvent_js_1.PlatformEvent {
    constructor(eventName, connectionId, eventType = PlatformEvent_js_1.EventType.Info) {
        super(eventName, eventType);
        this.privConnectionId = connectionId;
    }
    get connectionId() {
        return this.privConnectionId;
    }
}
exports.ConnectionEvent = ConnectionEvent;
class ConnectionStartEvent extends ConnectionEvent {
    constructor(connectionId, uri, headers) {
        super("ConnectionStartEvent", connectionId);
        this.privUri = uri;
        this.privHeaders = headers;
    }
    get uri() {
        return this.privUri;
    }
    get headers() {
        return this.privHeaders;
    }
}
exports.ConnectionStartEvent = ConnectionStartEvent;
class ConnectionEstablishedEvent extends ConnectionEvent {
    constructor(connectionId) {
        super("ConnectionEstablishedEvent", connectionId);
    }
}
exports.ConnectionEstablishedEvent = ConnectionEstablishedEvent;
class ConnectionClosedEvent extends ConnectionEvent {
    constructor(connectionId, statusCode, reason) {
        super("ConnectionClosedEvent", connectionId, PlatformEvent_js_1.EventType.Debug);
        this.privReason = reason;
        this.privStatusCode = statusCode;
    }
    get reason() {
        return this.privReason;
    }
    get statusCode() {
        return this.privStatusCode;
    }
}
exports.ConnectionClosedEvent = ConnectionClosedEvent;
class ConnectionErrorEvent extends ConnectionEvent {
    constructor(connectionId, message, type) {
        super("ConnectionErrorEvent", connectionId, PlatformEvent_js_1.EventType.Debug);
        this.privMessage = message;
        this.privType = type;
    }
    get message() {
        return this.privMessage;
    }
    get type() {
        return this.privType;
    }
}
exports.ConnectionErrorEvent = ConnectionErrorEvent;
class ConnectionEstablishErrorEvent extends ConnectionEvent {
    constructor(connectionId, statuscode, reason) {
        super("ConnectionEstablishErrorEvent", connectionId, PlatformEvent_js_1.EventType.Error);
        this.privStatusCode = statuscode;
        this.privReason = reason;
    }
    get reason() {
        return this.privReason;
    }
    get statusCode() {
        return this.privStatusCode;
    }
}
exports.ConnectionEstablishErrorEvent = ConnectionEstablishErrorEvent;
class ConnectionMessageReceivedEvent extends ConnectionEvent {
    constructor(connectionId, networkReceivedTimeISO, message) {
        super("ConnectionMessageReceivedEvent", connectionId);
        this.privNetworkReceivedTime = networkReceivedTimeISO;
        this.privMessage = message;
    }
    get networkReceivedTime() {
        return this.privNetworkReceivedTime;
    }
    get message() {
        return this.privMessage;
    }
}
exports.ConnectionMessageReceivedEvent = ConnectionMessageReceivedEvent;
class ConnectionMessageSentEvent extends ConnectionEvent {
    constructor(connectionId, networkSentTimeISO, message) {
        super("ConnectionMessageSentEvent", connectionId);
        this.privNetworkSentTime = networkSentTimeISO;
        this.privMessage = message;
    }
    get networkSentTime() {
        return this.privNetworkSentTime;
    }
    get message() {
        return this.privMessage;
    }
}
exports.ConnectionMessageSentEvent = ConnectionMessageSentEvent;
class ConnectionRedirectEvent extends ConnectionEvent {
    constructor(connectionId, redirectUrl, originalUrl, context) {
        super("ConnectionRedirectEvent", connectionId, PlatformEvent_js_1.EventType.Info);
        this.privRedirectUrl = redirectUrl;
        this.privOriginalUrl = originalUrl;
        this.privContext = context;
    }
    get redirectUrl() {
        return this.privRedirectUrl;
    }
    get originalUrl() {
        return this.privOriginalUrl;
    }
    get context() {
        return this.privContext;
    }
}
exports.ConnectionRedirectEvent = ConnectionRedirectEvent;

//# sourceMappingURL=ConnectionEvents.js.map
