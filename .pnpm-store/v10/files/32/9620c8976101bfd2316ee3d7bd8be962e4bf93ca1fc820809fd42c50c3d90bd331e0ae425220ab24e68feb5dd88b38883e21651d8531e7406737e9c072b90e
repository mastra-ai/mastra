import { PostHog } from '../../posthog-core';
import { Properties, RemoteConfig, SessionStartReason } from '../../types';
import { type eventWithTime } from './types/rrweb-types';
import { SessionRecordingStatus, TriggerType } from './external/triggerMatching';
export declare class SessionRecording {
    private readonly _instance;
    _forceAllowLocalhostNetworkCapture: boolean;
    private _receivedFlags;
    private _persistFlagsOnSessionListener;
    private _lazyLoadedSessionRecording;
    get started(): boolean;
    /**
     * defaults to buffering mode until a flags response is received
     * once a flags response is received status can be disabled, active or sampled
     */
    get status(): SessionRecordingStatus;
    constructor(_instance: PostHog);
    private get _isRecordingEnabled();
    startIfEnabledOrStop(startReason?: SessionStartReason): void;
    /**
     * session recording waits until it receives remote config before loading the script
     * this is to ensure we can control the script name remotely
     * and because we wait until we have local and remote config to determine if we should start at all
     * if start is called and there is no remote config then we wait until there is
     */
    private _lazyLoadAndStart;
    stopRecording(): void;
    private _resetSampling;
    private _persistRemoteConfig;
    onRemoteConfig(response: RemoteConfig): void;
    log(message: string, level?: 'log' | 'warn' | 'error'): void;
    private get _scriptName();
    private _onScriptLoaded;
    /**
     * this is maintained on the public API only because it has always been on the public API
     * if you are calling this directly you are certainly doing something wrong
     * @deprecated
     */
    onRRwebEmit(rawEvent: eventWithTime): void;
    /**
     * this ignores the linked flag config and (if other conditions are met) causes capture to start
     *
     * It is not usual to call this directly,
     * instead call `posthog.startSessionRecording({linked_flag: true})`
     * */
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
    get sdkDebugProperties(): Properties;
    /**
     * This adds a custom event to the session recording
     *
     * It is not intended for arbitrary public use - playback only displays known custom events
     * And is exposed on the public interface only so that other parts of the SDK are able to use it
     *
     * if you are calling this from client code, you're probably looking for `posthog.capture('$custom_event', {...})`
     */
    tryAddCustomEvent(tag: string, payload: any): boolean;
}
