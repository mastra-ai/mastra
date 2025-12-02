import { ConnectionEventArgs, ConnectionMessageEventArgs, ConversationTranscriber, Recognizer, ServiceEventArgs, SpeechSynthesizer } from "./Exports.js";
/**
 * Connection is a proxy class for managing connection to the speech service of the specified Recognizer.
 * By default, a Recognizer autonomously manages connection to service when needed.
 * The Connection class provides additional methods for users to explicitly open or close a connection and
 * to subscribe to connection status changes.
 * The use of Connection is optional, and mainly for scenarios where fine tuning of application
 * behavior based on connection status is needed. Users can optionally call Open() to manually set up a connection
 * in advance before starting recognition on the Recognizer associated with this Connection.
 * If the Recognizer needs to connect or disconnect to service, it will
 * setup or shutdown the connection independently. In this case the Connection will be notified by change of connection
 * status via Connected/Disconnected events.
 * Added in version 1.2.1.
 */
export declare class Connection {
    private privInternalData;
    private privEventListener;
    private privServiceEventListener;
    /**
     * Gets the Connection instance from the specified recognizer.
     * @param recognizer The recognizer associated with the connection.
     * @return The Connection instance of the recognizer.
     */
    static fromRecognizer(recognizer: Recognizer | ConversationTranscriber): Connection;
    /**
     * Gets the Connection instance from the specified synthesizer.
     * @param synthesizer The synthesizer associated with the connection.
     * @return The Connection instance of the synthesizer.
     */
    static fromSynthesizer(synthesizer: SpeechSynthesizer): Connection;
    /**
     * Starts to set up connection to the service.
     * Users can optionally call openConnection() to manually set up a connection in advance before starting recognition on the
     * Recognizer associated with this Connection. After starting recognition, calling Open() will have no effect
     *
     * Note: On return, the connection might not be ready yet. Please subscribe to the Connected event to
     * be notified when the connection is established.
     */
    openConnection(cb?: () => void, err?: (error: string) => void): void;
    /**
     * Closes the connection the service.
     * Users can optionally call closeConnection() to manually shutdown the connection of the associated Recognizer.
     *
     * If closeConnection() is called during recognition, recognition will fail and cancel with an error.
     */
    closeConnection(cb?: () => void, err?: (error: string) => void): void;
    /**
     * Appends a parameter in a message to service.
     * Added in version 1.12.1.
     * @param path The path of the network message.
     * @param propertyName Name of the property
     * @param propertyValue Value of the property. This is a json string.
     */
    setMessageProperty(path: string, propertyName: string, propertyValue: string | object): void;
    /**
     * Sends a message to the speech service.
     * Added in version 1.13.0.
     * @param path The WebSocket path of the message
     * @param payload The payload of the message. This is a json string or a ArrayBuffer.
     * @param success A callback to indicate success.
     * @param error A callback to indicate an error.
     */
    sendMessageAsync(path: string, payload: string | ArrayBuffer, success?: () => void, error?: (error: string) => void): void;
    /**
     * Any message from service that is not being processed by any other top level recognizers.
     *
     * Will be removed in 2.0.
     */
    receivedServiceMessage: (args: ServiceEventArgs) => void;
    /**
     * Any message received from the Speech Service.
     */
    messageReceived: (args: ConnectionMessageEventArgs) => void;
    /**
     * Any message sent to the Speech Service.
     */
    messageSent: (args: ConnectionMessageEventArgs) => void;
    /**
     * The Connected event to indicate that the recognizer is connected to service.
     */
    connected: (args: ConnectionEventArgs) => void;
    /**
     * The Disconnected event to indicate that the recognizer is disconnected from service.
     */
    disconnected: (args: ConnectionEventArgs) => void;
    /**
     * Dispose of associated resources.
     */
    close(): void;
    private setupEvents;
}
