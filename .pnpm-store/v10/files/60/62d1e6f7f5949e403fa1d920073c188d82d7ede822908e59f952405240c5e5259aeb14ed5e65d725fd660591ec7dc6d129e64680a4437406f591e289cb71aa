import { IAudioSource } from "../common/Exports.js";
import { CancellationErrorCode, CancellationReason, IntentRecognizer } from "../sdk/Exports.js";
import { AddedLmIntent, ServiceRecognizerBase } from "./Exports.js";
import { IAuthentication } from "./IAuthentication.js";
import { IConnectionFactory } from "./IConnectionFactory.js";
import { RecognizerConfig } from "./RecognizerConfig.js";
import { SpeechConnectionMessage } from "./SpeechConnectionMessage.Internal.js";
export declare class IntentServiceRecognizer extends ServiceRecognizerBase {
    private privIntentRecognizer;
    private privAddedLmIntents;
    private privIntentDataSent;
    private privUmbrellaIntent;
    private privPendingIntentArgs;
    constructor(authentication: IAuthentication, connectionFactory: IConnectionFactory, audioSource: IAudioSource, recognizerConfig: RecognizerConfig, recognizer: IntentRecognizer);
    setIntents(addedIntents: {
        [id: string]: AddedLmIntent;
    }, umbrellaIntent: AddedLmIntent): void;
    protected processTypeSpecificMessages(connectionMessage: SpeechConnectionMessage): Promise<boolean>;
    protected cancelRecognition(sessionId: string, requestId: string, cancellationReason: CancellationReason, errorCode: CancellationErrorCode, error: string): void;
}
