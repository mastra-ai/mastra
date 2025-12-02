import { IAudioSource } from "../common/Exports.js";
import { CancellationErrorCode, CancellationReason, SpeechRecognitionResult, TranslationRecognizer } from "../sdk/Exports.js";
import { ConversationServiceRecognizer } from "./Exports.js";
import { IAuthentication } from "./IAuthentication.js";
import { IConnectionFactory } from "./IConnectionFactory.js";
import { RecognizerConfig } from "./RecognizerConfig.js";
import { SpeechConnectionMessage } from "./SpeechConnectionMessage.Internal.js";
export declare class TranslationServiceRecognizer extends ConversationServiceRecognizer {
    private privTranslationRecognizer;
    constructor(authentication: IAuthentication, connectionFactory: IConnectionFactory, audioSource: IAudioSource, recognizerConfig: RecognizerConfig, translationRecognizer: TranslationRecognizer);
    protected processTypeSpecificMessages(connectionMessage: SpeechConnectionMessage): Promise<boolean>;
    protected cancelRecognition(sessionId: string, requestId: string, cancellationReason: CancellationReason, errorCode: CancellationErrorCode, error: string): void;
    protected handleRecognizingCallback(result: SpeechRecognitionResult, offset: number, sessionId: string): void;
    protected handleRecognizedCallback(result: SpeechRecognitionResult, offset: number, sessionId: string): void;
    private fireEventForResult;
    private sendSynthesisAudio;
}
