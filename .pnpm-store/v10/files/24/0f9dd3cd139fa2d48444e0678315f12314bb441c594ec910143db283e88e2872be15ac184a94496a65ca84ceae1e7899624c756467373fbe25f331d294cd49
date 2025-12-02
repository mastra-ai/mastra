import { AuthInfo, IAuthentication } from "./IAuthentication.js";
/**
 * @class
 */
export declare class CognitiveSubscriptionKeyAuthentication implements IAuthentication {
    private privAuthInfo;
    /**
     * Creates and initializes an instance of the CognitiveSubscriptionKeyAuthentication class.
     * @constructor
     * @param {string} subscriptionKey - The subscription key
     */
    constructor(subscriptionKey: string);
    /**
     * Fetches the subscription key.
     * @member
     * @function
     * @public
     * @param {string} authFetchEventId - The id to fetch.
     */
    fetch(authFetchEventId: string): Promise<AuthInfo>;
    /**
     * Fetches the subscription key.
     * @member
     * @function
     * @public
     * @param {string} authFetchEventId - The id to fetch.
     */
    fetchOnExpiry(authFetchEventId: string): Promise<AuthInfo>;
}
