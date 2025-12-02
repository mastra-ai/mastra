import { EventType, PlatformEvent } from "../common/Exports.js";
export declare class SpeechSynthesisEvent extends PlatformEvent {
    private privRequestId;
    constructor(eventName: string, requestId: string, eventType?: EventType);
    get requestId(): string;
}
export declare class SynthesisTriggeredEvent extends SpeechSynthesisEvent {
    private privSessionAudioDestinationId;
    private privTurnAudioDestinationId;
    constructor(requestId: string, sessionAudioDestinationId: string, turnAudioDestinationId: string);
    get audioSessionDestinationId(): string;
    get audioTurnDestinationId(): string;
}
export declare class ConnectingToSynthesisServiceEvent extends SpeechSynthesisEvent {
    private privAuthFetchEventId;
    constructor(requestId: string, authFetchEventId: string);
    get authFetchEventId(): string;
}
export declare class SynthesisStartedEvent extends SpeechSynthesisEvent {
    private privAuthFetchEventId;
    constructor(requestId: string, authFetchEventId: string);
    get authFetchEventId(): string;
}
