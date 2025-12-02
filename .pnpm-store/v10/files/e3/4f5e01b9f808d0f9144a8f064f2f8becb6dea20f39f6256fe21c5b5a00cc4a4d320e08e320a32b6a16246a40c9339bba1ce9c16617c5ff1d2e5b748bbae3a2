import { IConnection, IStringDictionary } from "../common/Exports.js";
import { ConnectionFactoryBase } from "./ConnectionFactoryBase.js";
import { AuthInfo, RecognizerConfig } from "./Exports.js";
export declare class ConversationTranscriberConnectionFactory extends ConnectionFactoryBase {
    private readonly universalUri;
    private readonly conversationRelativeUriV1;
    create(config: RecognizerConfig, authInfo: AuthInfo, connectionId?: string): Promise<IConnection>;
    protected setV2UrlParams(config: RecognizerConfig, queryParams: IStringDictionary<string>, endpoint: string): void;
}
