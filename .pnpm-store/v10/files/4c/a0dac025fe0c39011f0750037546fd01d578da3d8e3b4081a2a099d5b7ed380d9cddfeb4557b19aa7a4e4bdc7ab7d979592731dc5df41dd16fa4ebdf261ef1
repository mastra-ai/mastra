import { PropertyCollection } from "../../sdk/Exports.js";
export declare class ConversationManager {
    private privRequestParams;
    private privErrors;
    private privHost;
    private privApiVersion;
    private privRestPath;
    private privRestAdapter;
    constructor();
    /**
     * Make a POST request to the Conversation Manager service endpoint to create or join a conversation.
     * @param args
     * @param conversationCode
     * @param callback
     * @param errorCallback
     */
    createOrJoin(args: PropertyCollection, conversationCode: string, cb?: (c: any) => void, err?: (e: string) => void): void;
    /**
     * Make a DELETE request to the Conversation Manager service endpoint to leave the conversation.
     * @param args
     * @param sessionToken
     * @param callback
     */
    leave(args: PropertyCollection, sessionToken: string): Promise<void>;
}
