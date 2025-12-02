export declare enum AvatarEventTypes {
    SwitchedToSpeaking = "SwitchedToSpeaking",
    SwitchedToIdle = "SwitchedToIdle",
    SessionClosed = "SessionClosed"
}
/**
 * Defines content for talking avatar events.
 * @class AvatarEventArgs
 * Added in version 1.33.0
 *
 * @experimental This feature is experimental and might change or have limited support.
 */
export declare class AvatarEventArgs {
    private privType;
    private privOffset;
    private privDescription;
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {number} audioOffset - The audio offset.
     * @param {string} description - The description of the event.
     */
    constructor(audioOffset: number, description: string);
    /**
     * The type of the event.
     * @public
     * @returns {AvatarEventTypes} The type of the event.
     */
    get type(): AvatarEventTypes;
    /**
     * The time offset associated with this event.
     * @public
     * @returns {number} The time offset associated with this event.
     */
    get offset(): number;
    /**
     * The description of the event.
     * @public
     * @returns {string} The description of the event.
     */
    get description(): string;
}
