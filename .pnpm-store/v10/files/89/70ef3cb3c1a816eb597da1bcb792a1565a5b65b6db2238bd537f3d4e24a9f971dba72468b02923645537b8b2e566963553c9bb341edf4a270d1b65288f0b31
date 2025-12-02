"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.OCSPCacheUpdateErrorEvent = exports.OCSPResponseRetrievedEvent = exports.OCSPCacheFetchErrorEvent = exports.OCSPVerificationFailedEvent = exports.OCSPCacheHitEvent = exports.OCSPCacheEntryNeedsRefreshEvent = exports.OCSPCacheEntryExpiredEvent = exports.OCSPWSUpgradeStartedEvent = exports.OCSPStapleReceivedEvent = exports.OCSPCacheUpdateCompleteEvent = exports.OCSPDiskCacheStoreEvent = exports.OCSPMemoryCacheStoreEvent = exports.OCSPCacheUpdateNeededEvent = exports.OCSPDiskCacheHitEvent = exports.OCSPCacheMissEvent = exports.OCSPMemoryCacheHitEvent = exports.OCSPEvent = void 0;
/* eslint-disable max-classes-per-file */
const PlatformEvent_js_1 = require("./PlatformEvent.js");
class OCSPEvent extends PlatformEvent_js_1.PlatformEvent {
    constructor(eventName, eventType, signature) {
        super(eventName, eventType);
        this.privSignature = signature;
    }
}
exports.OCSPEvent = OCSPEvent;
class OCSPMemoryCacheHitEvent extends OCSPEvent {
    constructor(signature) {
        super("OCSPMemoryCacheHitEvent", PlatformEvent_js_1.EventType.Debug, signature);
    }
}
exports.OCSPMemoryCacheHitEvent = OCSPMemoryCacheHitEvent;
class OCSPCacheMissEvent extends OCSPEvent {
    constructor(signature) {
        super("OCSPCacheMissEvent", PlatformEvent_js_1.EventType.Debug, signature);
    }
}
exports.OCSPCacheMissEvent = OCSPCacheMissEvent;
class OCSPDiskCacheHitEvent extends OCSPEvent {
    constructor(signature) {
        super("OCSPDiskCacheHitEvent", PlatformEvent_js_1.EventType.Debug, signature);
    }
}
exports.OCSPDiskCacheHitEvent = OCSPDiskCacheHitEvent;
class OCSPCacheUpdateNeededEvent extends OCSPEvent {
    constructor(signature) {
        super("OCSPCacheUpdateNeededEvent", PlatformEvent_js_1.EventType.Debug, signature);
    }
}
exports.OCSPCacheUpdateNeededEvent = OCSPCacheUpdateNeededEvent;
class OCSPMemoryCacheStoreEvent extends OCSPEvent {
    constructor(signature) {
        super("OCSPMemoryCacheStoreEvent", PlatformEvent_js_1.EventType.Debug, signature);
    }
}
exports.OCSPMemoryCacheStoreEvent = OCSPMemoryCacheStoreEvent;
class OCSPDiskCacheStoreEvent extends OCSPEvent {
    constructor(signature) {
        super("OCSPDiskCacheStoreEvent", PlatformEvent_js_1.EventType.Debug, signature);
    }
}
exports.OCSPDiskCacheStoreEvent = OCSPDiskCacheStoreEvent;
class OCSPCacheUpdateCompleteEvent extends OCSPEvent {
    constructor(signature) {
        super("OCSPCacheUpdateCompleteEvent", PlatformEvent_js_1.EventType.Debug, signature);
    }
}
exports.OCSPCacheUpdateCompleteEvent = OCSPCacheUpdateCompleteEvent;
class OCSPStapleReceivedEvent extends OCSPEvent {
    constructor() {
        super("OCSPStapleReceivedEvent", PlatformEvent_js_1.EventType.Debug, "");
    }
}
exports.OCSPStapleReceivedEvent = OCSPStapleReceivedEvent;
class OCSPWSUpgradeStartedEvent extends OCSPEvent {
    constructor(serialNumber) {
        super("OCSPWSUpgradeStartedEvent", PlatformEvent_js_1.EventType.Debug, serialNumber);
    }
}
exports.OCSPWSUpgradeStartedEvent = OCSPWSUpgradeStartedEvent;
class OCSPCacheEntryExpiredEvent extends OCSPEvent {
    constructor(serialNumber, expireTime) {
        super("OCSPCacheEntryExpiredEvent", PlatformEvent_js_1.EventType.Debug, serialNumber);
        this.privExpireTime = expireTime;
    }
}
exports.OCSPCacheEntryExpiredEvent = OCSPCacheEntryExpiredEvent;
class OCSPCacheEntryNeedsRefreshEvent extends OCSPEvent {
    constructor(serialNumber, startTime, expireTime) {
        super("OCSPCacheEntryNeedsRefreshEvent", PlatformEvent_js_1.EventType.Debug, serialNumber);
        this.privExpireTime = expireTime;
        this.privStartTime = startTime;
    }
}
exports.OCSPCacheEntryNeedsRefreshEvent = OCSPCacheEntryNeedsRefreshEvent;
class OCSPCacheHitEvent extends OCSPEvent {
    constructor(serialNumber, startTime, expireTime) {
        super("OCSPCacheHitEvent", PlatformEvent_js_1.EventType.Debug, serialNumber);
        this.privExpireTime = expireTime;
        this.privExpireTimeString = new Date(expireTime).toLocaleDateString();
        this.privStartTime = startTime;
        this.privStartTimeString = new Date(startTime).toLocaleTimeString();
    }
}
exports.OCSPCacheHitEvent = OCSPCacheHitEvent;
class OCSPVerificationFailedEvent extends OCSPEvent {
    constructor(serialNumber, error) {
        super("OCSPVerificationFailedEvent", PlatformEvent_js_1.EventType.Debug, serialNumber);
        this.privError = error;
    }
}
exports.OCSPVerificationFailedEvent = OCSPVerificationFailedEvent;
class OCSPCacheFetchErrorEvent extends OCSPEvent {
    constructor(serialNumber, error) {
        super("OCSPCacheFetchErrorEvent", PlatformEvent_js_1.EventType.Debug, serialNumber);
        this.privError = error;
    }
}
exports.OCSPCacheFetchErrorEvent = OCSPCacheFetchErrorEvent;
class OCSPResponseRetrievedEvent extends OCSPEvent {
    constructor(serialNumber) {
        super("OCSPResponseRetrievedEvent", PlatformEvent_js_1.EventType.Debug, serialNumber);
    }
}
exports.OCSPResponseRetrievedEvent = OCSPResponseRetrievedEvent;
class OCSPCacheUpdateErrorEvent extends OCSPEvent {
    constructor(serialNumber, error) {
        super("OCSPCacheUpdateErrorEvent", PlatformEvent_js_1.EventType.Debug, serialNumber);
        this.privError = error;
    }
}
exports.OCSPCacheUpdateErrorEvent = OCSPCacheUpdateErrorEvent;

//# sourceMappingURL=OCSPEvents.js.map
