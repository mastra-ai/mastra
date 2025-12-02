import { SessionEventArgs } from "./Exports.js";
/**
 * Defines payload for any Service message event
 * Added in version 1.9.0
 */
export declare class ServiceEventArgs extends SessionEventArgs {
    private privJsonResult;
    private privEventName;
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {string} json - json payload of the USP message.
     */
    constructor(json: string, name: string, sessionId?: string);
    get jsonString(): string;
    get eventName(): string;
}
