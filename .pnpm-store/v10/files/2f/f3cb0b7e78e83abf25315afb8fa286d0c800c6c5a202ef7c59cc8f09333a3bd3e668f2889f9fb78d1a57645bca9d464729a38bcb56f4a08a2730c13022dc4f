import { IAudioSource, IConnection } from "../../common/Exports.js";
import { CancellationErrorCode, CancellationReason } from "../../sdk/Exports.js";
import { IAuthentication, IConnectionFactory, RecognizerConfig, ServiceRecognizerBase } from "../Exports.js";
import { ConversationTranslatorRecognizer } from "./ConversationTranslatorRecognizer.js";
/**
 * The service adapter handles sending and receiving messages to the Conversation Translator websocket.
 */
export declare class ConversationServiceAdapter extends ServiceRecognizerBase {
    private privConversationServiceConnector;
    private privConversationConnectionFactory;
    private privConversationAuthFetchEventId;
    private privConversationAuthentication;
    private privConversationRequestSession;
    private privConnectionConfigPromise;
    private privConnectionLoop;
    private terminateMessageLoop;
    private privLastPartialUtteranceId;
    private privConversationIsDisposed;
    constructor(authentication: IAuthentication, connectionFactory: IConnectionFactory, audioSource: IAudioSource, recognizerConfig: RecognizerConfig, conversationServiceConnector: ConversationTranslatorRecognizer);
    isDisposed(): boolean;
    dispose(reason?: string): Promise<void>;
    sendMessage(message: string): Promise<void>;
    sendMessageAsync(message: string): Promise<void>;
    protected privDisconnect(): Promise<void>;
    protected processTypeSpecificMessages(): Promise<boolean>;
    protected cancelRecognition(sessionId: string, requestId: string, cancellationReason: CancellationReason, errorCode: CancellationErrorCode, error: string): void;
    /**
     * Establishes a websocket connection to the end point.
     */
    protected conversationConnectImpl(connection: Promise<IConnection>): Promise<IConnection>;
    /**
     * Process incoming websocket messages
     */
    private receiveConversationMessageOverride;
    private startMessageLoop;
    private configConnection;
    private getTranslations;
}
