import { EventType, eventWithTime, IncrementalSource } from '../types/rrweb-types';
import { SessionRecordingStatus, TriggerType } from './triggerMatching';
import { LazyLoadedSessionRecordingInterface } from '../../../utils/globals';
import { PostHog } from '../../../posthog-core';
import { Properties, SessionRecordingPersistedConfig, SessionStartReason } from '../../../types';
export declare const RECORDING_IDLE_THRESHOLD_MS: number;
export declare const RECORDING_MAX_EVENT_SIZE: number;
export declare const RECORDING_BUFFER_TIMEOUT = 2000;
export declare const SESSION_RECORDING_BATCH_KEY = "recordings";
export interface SnapshotBuffer {
    size: number;
    data: any[];
    sessionId: string;
    windowId: string;
}
export type compressedFullSnapshotEvent = {
    type: EventType.FullSnapshot;
    data: string;
};
export type compressedIncrementalSnapshotEvent = {
    type: EventType.IncrementalSnapshot;
    data: {
        source: IncrementalSource;
        texts: string;
        attributes: string;
        removes: string;
        adds: string;
    };
};
export type compressedIncrementalStyleSnapshotEvent = {
    type: EventType.IncrementalSnapshot;
    data: {
        source: IncrementalSource.StyleSheetRule;
        id?: number;
        styleId?: number;
        replace?: string;
        replaceSync?: string;
        adds?: string;
        removes?: string;
    };
};
export type compressedEvent = compressedIncrementalStyleSnapshotEvent | compressedFullSnapshotEvent | compressedIncrementalSnapshotEvent;
export type compressedEventWithTime = compressedEvent & {
    timestamp: number;
    delay?: number;
    cv: '2024-10';
};
export declare const SEVEN_MEGABYTES: number;
export declare function splitBuffer(buffer: SnapshotBuffer, sizeLimit?: number): SnapshotBuffer[];
export declare class LazyLoadedSessionRecording implements LazyLoadedSessionRecordingInterface {
    private readonly _instance;
    private _endpoint;
    private _mutationThrottler?;
    /**
     * Util to help developers working on this feature manually override
     */
    private _forceAllowLocalhostNetworkCapture;
    private _stopRrweb;
    private _lastActivityTimestamp;
    /**
     * if pageview capture is disabled,
     * then we can manually track href changes
     */
    private _lastHref?;
    /**
     * and a queue - that contains rrweb events that we want to send to rrweb, but rrweb wasn't able to accept them yet
     */
    private _queuedRRWebEvents;
    private _isIdle;
    private _linkedFlagMatching;
    private _urlTriggerMatching;
    private _eventTriggerMatching;
    private _triggerMatching;
    private _fullSnapshotTimer?;
    private _windowId;
    private _sessionId;
    get sessionId(): string;
    private _flushBufferTimer?;
    private _buffer;
    private _removePageViewCaptureHook;
    private _removeEventTriggerCaptureHook;
    private get _sessionManager();
    private get _sessionIdleThresholdMilliseconds();
    private get _isSampled();
    private get _sampleRate();
    private get _minimumDuration();
    private _statusMatcher;
    private _onSessionIdListener;
    private _onSessionIdleResetForcedListener;
    private _samplingSessionListener;
    private _forceIdleSessionIdListener;
    constructor(_instance: PostHog);
    private get _masking();
    private get _canvasRecording();
    private get _isConsoleLogCaptureEnabled();
    private get _networkPayloadCapture();
    private _gatherRRWebPlugins;
    private _maskUrl;
    private _tryRRWebMethod;
    private _tryAddCustomEvent;
    private _pageViewFallBack;
    private _processQueuedEvents;
    private _tryTakeFullSnapshot;
    private get _fullSnapshotIntervalMillis();
    private _scheduleFullSnapshot;
    private _pauseRecording;
    private _resumeRecording;
    private _activateTrigger;
    get isStarted(): boolean;
    get _remoteConfig(): SessionRecordingPersistedConfig | undefined;
    start(startReason?: SessionStartReason): void;
    private _onSessionIdCallback;
    stop(): void;
    onRRwebEmit(rawEvent: eventWithTime): void;
    get status(): SessionRecordingStatus;
    log(message: string, level?: 'log' | 'warn' | 'error'): void;
    overrideLinkedFlag(): void;
    /**
     * this ignores the sampling config and (if other conditions are met) causes capture to start
     *
     * It is not usual to call this directly,
     * instead call `posthog.startSessionRecording({sampling: true})`
     * */
    overrideSampling(): void;
    /**
     * this ignores the URL/Event trigger config and (if other conditions are met) causes capture to start
     *
     * It is not usual to call this directly,
     * instead call `posthog.startSessionRecording({trigger: 'url' | 'event'})`
     * */
    overrideTrigger(triggerType: TriggerType): void;
    private _clearFlushBufferTimer;
    private _flushBuffer;
    private _captureSnapshotBuffered;
    private _captureSnapshot;
    private get _sessionDuration();
    private _clearBufferBeforeMostRecentMeta;
    private _clearBuffer;
    private _onBeforeUnload;
    private _onOffline;
    private _onOnline;
    private _onVisibilityChange;
    private _reportStarted;
    private _isInteractiveEvent;
    private _updateWindowAndSessionIds;
    private _clearConditionalRecordingPersistence;
    private _makeSamplingDecision;
    private _addEventTriggerListener;
    get sdkDebugProperties(): Properties;
    private _startRecorder;
    tryAddCustomEvent(tag: string, payload: any): boolean;
}
