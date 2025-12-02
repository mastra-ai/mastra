import { EventType, PlatformEvent } from "../common/Exports.js";
export declare class SpeechRecognitionEvent extends PlatformEvent {
    private privRequestId;
    private privSessionId;
    constructor(eventName: string, requestId: string, sessionId: string, eventType?: EventType);
    get requestId(): string;
    get sessionId(): string;
}
export declare class RecognitionTriggeredEvent extends SpeechRecognitionEvent {
    private privAudioSourceId;
    private privAudioNodeId;
    constructor(requestId: string, sessionId: string, audioSourceId: string, audioNodeId: string);
    get audioSourceId(): string;
    get audioNodeId(): string;
}
export declare class ListeningStartedEvent extends SpeechRecognitionEvent {
    private privAudioSourceId;
    private privAudioNodeId;
    constructor(requestId: string, sessionId: string, audioSourceId: string, audioNodeId: string);
    get audioSourceId(): string;
    get audioNodeId(): string;
}
export declare class ConnectingToServiceEvent extends SpeechRecognitionEvent {
    private privAuthFetchEventid;
    constructor(requestId: string, authFetchEventid: string, sessionId: string);
    get authFetchEventid(): string;
}
export declare class RecognitionStartedEvent extends SpeechRecognitionEvent {
    private privAudioSourceId;
    private privAudioNodeId;
    private privAuthFetchEventId;
    constructor(requestId: string, audioSourceId: string, audioNodeId: string, authFetchEventId: string, sessionId: string);
    get audioSourceId(): string;
    get audioNodeId(): string;
    get authFetchEventId(): string;
}
export declare enum RecognitionCompletionStatus {
    Success = 0,
    AudioSourceError = 1,
    AudioSourceTimeout = 2,
    AuthTokenFetchError = 3,
    AuthTokenFetchTimeout = 4,
    UnAuthorized = 5,
    ConnectTimeout = 6,
    ConnectError = 7,
    ClientRecognitionActivityTimeout = 8,
    UnknownError = 9
}
export declare class RecognitionEndedEvent extends SpeechRecognitionEvent {
    private privAudioSourceId;
    private privAudioNodeId;
    private privAuthFetchEventId;
    private privServiceTag;
    private privStatus;
    private privError;
    constructor(requestId: string, audioSourceId: string, audioNodeId: string, authFetchEventId: string, sessionId: string, serviceTag: string, status: RecognitionCompletionStatus, error: string);
    get audioSourceId(): string;
    get audioNodeId(): string;
    get authFetchEventId(): string;
    get serviceTag(): string;
    get status(): RecognitionCompletionStatus;
    get error(): string;
}
