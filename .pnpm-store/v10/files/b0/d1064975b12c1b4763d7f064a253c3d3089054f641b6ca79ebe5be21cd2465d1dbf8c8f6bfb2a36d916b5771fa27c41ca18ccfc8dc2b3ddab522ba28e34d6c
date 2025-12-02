import { EventType, PlatformEvent } from "./PlatformEvent.js";
export declare class AudioSourceEvent extends PlatformEvent {
    private privAudioSourceId;
    constructor(eventName: string, audioSourceId: string, eventType?: EventType);
    get audioSourceId(): string;
}
export declare class AudioSourceInitializingEvent extends AudioSourceEvent {
    constructor(audioSourceId: string);
}
export declare class AudioSourceReadyEvent extends AudioSourceEvent {
    constructor(audioSourceId: string);
}
export declare class AudioSourceOffEvent extends AudioSourceEvent {
    constructor(audioSourceId: string);
}
export declare class AudioSourceErrorEvent extends AudioSourceEvent {
    private privError;
    constructor(audioSourceId: string, error: string);
    get error(): string;
}
export declare class AudioStreamNodeEvent extends AudioSourceEvent {
    private privAudioNodeId;
    constructor(eventName: string, audioSourceId: string, audioNodeId: string);
    get audioNodeId(): string;
}
export declare class AudioStreamNodeAttachingEvent extends AudioStreamNodeEvent {
    constructor(audioSourceId: string, audioNodeId: string);
}
export declare class AudioStreamNodeAttachedEvent extends AudioStreamNodeEvent {
    constructor(audioSourceId: string, audioNodeId: string);
}
export declare class AudioStreamNodeDetachedEvent extends AudioStreamNodeEvent {
    constructor(audioSourceId: string, audioNodeId: string);
}
export declare class AudioStreamNodeErrorEvent extends AudioStreamNodeEvent {
    private privError;
    constructor(audioSourceId: string, audioNodeId: string, error: string);
    get error(): string;
}
