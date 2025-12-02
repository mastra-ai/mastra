import { EventType, PlatformEvent } from "./PlatformEvent.js";
export declare class OCSPEvent extends PlatformEvent {
    private privSignature;
    constructor(eventName: string, eventType: EventType, signature: string);
}
export declare class OCSPMemoryCacheHitEvent extends OCSPEvent {
    constructor(signature: string);
}
export declare class OCSPCacheMissEvent extends OCSPEvent {
    constructor(signature: string);
}
export declare class OCSPDiskCacheHitEvent extends OCSPEvent {
    constructor(signature: string);
}
export declare class OCSPCacheUpdateNeededEvent extends OCSPEvent {
    constructor(signature: string);
}
export declare class OCSPMemoryCacheStoreEvent extends OCSPEvent {
    constructor(signature: string);
}
export declare class OCSPDiskCacheStoreEvent extends OCSPEvent {
    constructor(signature: string);
}
export declare class OCSPCacheUpdateCompleteEvent extends OCSPEvent {
    constructor(signature: string);
}
export declare class OCSPStapleReceivedEvent extends OCSPEvent {
    constructor();
}
export declare class OCSPWSUpgradeStartedEvent extends OCSPEvent {
    constructor(serialNumber: string);
}
export declare class OCSPCacheEntryExpiredEvent extends OCSPEvent {
    private privExpireTime;
    constructor(serialNumber: string, expireTime: number);
}
export declare class OCSPCacheEntryNeedsRefreshEvent extends OCSPEvent {
    private privExpireTime;
    private privStartTime;
    constructor(serialNumber: string, startTime: number, expireTime: number);
}
export declare class OCSPCacheHitEvent extends OCSPEvent {
    private privExpireTime;
    private privStartTime;
    private privExpireTimeString;
    private privStartTimeString;
    constructor(serialNumber: string, startTime: number, expireTime: number);
}
export declare class OCSPVerificationFailedEvent extends OCSPEvent {
    private privError;
    constructor(serialNumber: string, error: string);
}
export declare class OCSPCacheFetchErrorEvent extends OCSPEvent {
    private privError;
    constructor(serialNumber: string, error: string);
}
export declare class OCSPResponseRetrievedEvent extends OCSPEvent {
    constructor(serialNumber: string);
}
export declare class OCSPCacheUpdateErrorEvent extends OCSPEvent {
    private privError;
    constructor(serialNumber: string, error: string);
}
