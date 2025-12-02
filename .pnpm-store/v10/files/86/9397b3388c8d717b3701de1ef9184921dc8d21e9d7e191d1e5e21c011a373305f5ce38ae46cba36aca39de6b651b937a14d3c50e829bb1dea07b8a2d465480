import { IConnection } from "../../common/Exports.js";
import { ConversationImpl } from "../../sdk/Transcription/Conversation.js";
import { ConnectionFactoryBase } from "./../ConnectionFactoryBase.js";
import { AuthInfo, RecognizerConfig } from "./../Exports.js";
/**
 * Connection factory for the conversation translator. Handles connecting to the regular translator endpoint,
 * as well as the virtual microphone array transcription endpoint
 */
export declare class ConversationTranslatorConnectionFactory extends ConnectionFactoryBase {
    private static readonly CTS_VIRT_MIC_PATH;
    private privConvGetter;
    constructor(convGetter: () => ConversationImpl);
    create(config: RecognizerConfig, authInfo: AuthInfo, connectionId?: string): Promise<IConnection>;
}
