import { ConnectionMessage as IntConnectionMessage } from "../common/Exports.js";
import { PropertyCollection } from "./PropertyCollection.js";
/**
 * ConnectionMessage represents implementation specific messages sent to and received from
 * the speech service. These messages are provided for debugging purposes and should not
 * be used for production use cases with the Azure Cognitive Services Speech Service.
 * Messages sent to and received from the Speech Service are subject to change without
 * notice. This includes message contents, headers, payloads, ordering, etc.
 * Added in version 1.11.0.
 */
export declare abstract class ConnectionMessage {
    /**
     * The message path.
     */
    abstract get path(): string;
    /**
     * Checks to see if the ConnectionMessage is a text message.
     * See also IsBinaryMessage().
     */
    abstract get isTextMessage(): boolean;
    /**
     * Checks to see if the ConnectionMessage is a binary message.
     * See also GetBinaryMessage().
     */
    abstract get isBinaryMessage(): boolean;
    /**
     * Gets the text message payload. Typically the text message content-type is
     * application/json. To determine other content-types use
     * Properties.GetProperty("Content-Type").
     */
    abstract get TextMessage(): string;
    /**
     * Gets the binary message payload.
     */
    abstract get binaryMessage(): ArrayBuffer;
    /**
     * A collection of properties and their values defined for this <see cref="ConnectionMessage"/>.
     * Message headers can be accessed via this collection (e.g. "Content-Type").
     */
    abstract get properties(): PropertyCollection;
    /**
     * Returns a string that represents the connection message.
     */
    abstract toString(): string;
}
export declare class ConnectionMessageImpl {
    private privConnectionMessage;
    private privProperties;
    constructor(message: IntConnectionMessage);
    /**
     * The message path.
     */
    get path(): string;
    /**
     * Checks to see if the ConnectionMessage is a text message.
     * See also IsBinaryMessage().
     */
    get isTextMessage(): boolean;
    /**
     * Checks to see if the ConnectionMessage is a binary message.
     * See also GetBinaryMessage().
     */
    get isBinaryMessage(): boolean;
    /**
     * Gets the text message payload. Typically the text message content-type is
     * application/json. To determine other content-types use
     * Properties.GetProperty("Content-Type").
     */
    get TextMessage(): string;
    /**
     * Gets the binary message payload.
     */
    get binaryMessage(): ArrayBuffer;
    /**
     * A collection of properties and their values defined for this <see cref="ConnectionMessage"/>.
     * Message headers can be accessed via this collection (e.g. "Content-Type").
     */
    get properties(): PropertyCollection;
    /**
     * Returns a string that represents the connection message.
     */
    toString(): string;
}
