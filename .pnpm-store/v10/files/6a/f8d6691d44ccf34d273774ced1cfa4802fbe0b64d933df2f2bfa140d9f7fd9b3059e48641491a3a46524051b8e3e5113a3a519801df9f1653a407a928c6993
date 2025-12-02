import { IAudioSource } from "../common/Exports.js";
import { SpeakerRecognitionModel } from "../sdk/SpeakerRecognitionModel.js";
import { CancellationErrorCode, CancellationReason, SpeakerRecognitionResult, SpeakerRecognizer } from "../sdk/Exports.js";
import { ServiceRecognizerBase } from "./Exports.js";
import { IAuthentication } from "./IAuthentication.js";
import { IConnectionFactory } from "./IConnectionFactory.js";
import { RecognizerConfig } from "./RecognizerConfig.js";
import { SpeechConnectionMessage } from "./SpeechConnectionMessage.Internal.js";
export declare class SpeakerServiceRecognizer extends ServiceRecognizerBase {
    private privSpeakerRecognizer;
    private privSpeakerAudioSource;
    private privResultDeferral;
    private privSpeakerModel;
    constructor(authentication: IAuthentication, connectionFactory: IConnectionFactory, audioSource: IAudioSource, recognizerConfig: RecognizerConfig, recognizer: SpeakerRecognizer);
    protected processTypeSpecificMessages(connectionMessage: SpeechConnectionMessage): Promise<boolean>;
    protected cancelRecognition(sessionId: string, requestId: string, cancellationReason: CancellationReason, errorCode: CancellationErrorCode, error: string): void;
    recognizeSpeakerOnce(model: SpeakerRecognitionModel): Promise<SpeakerRecognitionResult>;
    private sendPreAudioMessages;
    private sendSpeakerRecognition;
    private extractSpeakerContext;
}
