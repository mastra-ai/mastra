import { IAudioSource } from "../common/Exports.js";
import { CancellationErrorCode, CancellationReason, Recognizer, SpeechRecognitionResult } from "../sdk/Exports.js";
import { IAuthentication, IConnectionFactory, RecognizerConfig, ServiceRecognizerBase } from "./Exports.js";
import { SpeechConnectionMessage } from "./SpeechConnectionMessage.Internal.js";
export declare class ConversationServiceRecognizer extends ServiceRecognizerBase {
    constructor(authentication: IAuthentication, connectionFactory: IConnectionFactory, audioSource: IAudioSource, recognizerConfig: RecognizerConfig, recognizer: Recognizer);
    protected processTypeSpecificMessages(connectionMessage: SpeechConnectionMessage): Promise<boolean>;
    protected handleRecognizedCallback(result: SpeechRecognitionResult, offset: number, sessionId: string): void;
    protected handleRecognizingCallback(result: SpeechRecognitionResult, duration: number, sessionId: string): void;
    protected processSpeechMessages(connectionMessage: SpeechConnectionMessage): Promise<boolean>;
    protected cancelRecognition(sessionId: string, requestId: string, cancellationReason: CancellationReason, errorCode: CancellationErrorCode, error: string): void;
    protected handleSpeechPhrase(textBody: string): Promise<void>;
    protected handleSpeechHypothesis(textBody: string): void;
}
