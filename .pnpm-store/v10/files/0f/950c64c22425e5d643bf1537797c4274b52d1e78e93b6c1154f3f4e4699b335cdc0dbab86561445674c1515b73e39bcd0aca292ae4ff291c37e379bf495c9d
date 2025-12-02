import { IEventListener, IStringDictionary, PlatformEvent } from "../common/Exports.js";
export interface ITelemetry {
    Metrics: IMetric[];
    ReceivedMessages: IStringDictionary<string[]>;
}
export interface IMetric {
    End?: string;
    Error?: string;
    Id?: string;
    Name?: string;
    Start?: string;
    PhraseLatencyMs?: number[];
    FirstHypothesisLatencyMs?: number[];
}
export declare class ServiceTelemetryListener implements IEventListener<PlatformEvent> {
    private privIsDisposed;
    private privRequestId;
    private privAudioSourceId;
    private privAudioNodeId;
    private privListeningTriggerMetric;
    private privMicMetric;
    private privConnectionEstablishMetric;
    private privMicStartTime;
    private privConnectionId;
    private privConnectionStartTime;
    private privReceivedMessages;
    private privPhraseLatencies;
    private privHypothesisLatencies;
    constructor(requestId: string, audioSourceId: string, audioNodeId: string);
    phraseReceived(audioReceivedTime: number): void;
    hypothesisReceived(audioReceivedTime: number): void;
    onEvent(e: PlatformEvent): void;
    getTelemetry(): string;
    get hasTelemetry(): boolean;
    dispose(): void;
    private getConnectionError;
}
