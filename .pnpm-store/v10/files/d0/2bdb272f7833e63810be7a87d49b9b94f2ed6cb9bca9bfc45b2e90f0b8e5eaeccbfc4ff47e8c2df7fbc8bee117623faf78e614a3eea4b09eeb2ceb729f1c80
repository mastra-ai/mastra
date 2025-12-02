import { IAudioSource, IConnection } from "../common/Exports.js";
import { CancellationErrorCode, CancellationReason, SpeechRecognitionResult } from "../sdk/Exports.js";
import { ConversationInfo, MeetingInfo } from "../sdk/Transcription/Exports.js";
import { ConversationServiceRecognizer, TranscriberRecognizer } from "./Exports.js";
import { IAuthentication } from "./IAuthentication.js";
import { IConnectionFactory } from "./IConnectionFactory.js";
import { RecognizerConfig } from "./RecognizerConfig.js";
import { SpeechConnectionMessage } from "./SpeechConnectionMessage.Internal.js";
export declare class TranscriptionServiceRecognizer extends ConversationServiceRecognizer {
    private privTranscriberRecognizer;
    constructor(authentication: IAuthentication, connectionFactory: IConnectionFactory, audioSource: IAudioSource, recognizerConfig: RecognizerConfig, transcriber: TranscriberRecognizer);
    sendSpeechEventAsync(info: ConversationInfo, command: string): Promise<void>;
    sendMeetingSpeechEventAsync(info: MeetingInfo, command: string): Promise<void>;
    protected processTypeSpecificMessages(connectionMessage: SpeechConnectionMessage): Promise<boolean>;
    protected handleRecognizedCallback(result: SpeechRecognitionResult, offset: number, sessionId: string): void;
    protected handleRecognizingCallback(result: SpeechRecognitionResult, duration: number, sessionId: string): void;
    protected cancelRecognition(sessionId: string, requestId: string, cancellationReason: CancellationReason, errorCode: CancellationErrorCode, error: string): void;
    protected sendTranscriptionStartJSON(connection: IConnection): Promise<void>;
    protected sendSpeechEvent(connection: IConnection, payload: {
        [id: string]: any;
    }): Promise<void>;
    private createSpeechEventPayload;
    private createMeetingSpeechEventPayload;
}
