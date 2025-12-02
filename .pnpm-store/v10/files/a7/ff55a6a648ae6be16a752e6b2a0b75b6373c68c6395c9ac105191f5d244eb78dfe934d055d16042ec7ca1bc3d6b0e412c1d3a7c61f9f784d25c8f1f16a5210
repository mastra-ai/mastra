import { IAudioSource } from "../common/Exports.js";
import { CancellationErrorCode, CancellationReason, SpeechRecognizer } from "../sdk/Exports.js";
import { ServiceRecognizerBase } from "./Exports.js";
import { IAuthentication } from "./IAuthentication.js";
import { IConnectionFactory } from "./IConnectionFactory.js";
import { RecognizerConfig } from "./RecognizerConfig.js";
import { SpeechConnectionMessage } from "./SpeechConnectionMessage.Internal.js";
export declare class SpeechServiceRecognizer extends ServiceRecognizerBase {
    private privSpeechRecognizer;
    constructor(authentication: IAuthentication, connectionFactory: IConnectionFactory, audioSource: IAudioSource, recognizerConfig: RecognizerConfig, speechRecognizer: SpeechRecognizer);
    protected processTypeSpecificMessages(connectionMessage: SpeechConnectionMessage): Promise<boolean>;
    protected cancelRecognition(sessionId: string, requestId: string, cancellationReason: CancellationReason, errorCode: CancellationErrorCode, error: string): void;
}
