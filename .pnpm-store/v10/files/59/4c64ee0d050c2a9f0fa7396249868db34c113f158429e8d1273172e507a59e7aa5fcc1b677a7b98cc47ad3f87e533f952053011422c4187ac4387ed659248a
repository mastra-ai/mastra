import { IConnection, IStringDictionary } from "../common/Exports.js";
import { ConnectionFactoryBase } from "./ConnectionFactoryBase.js";
import { AuthInfo, RecognizerConfig } from "./Exports.js";
export declare class TranscriberConnectionFactory extends ConnectionFactoryBase {
    private readonly multiaudioRelativeUri;
    create(config: RecognizerConfig, authInfo: AuthInfo, connectionId?: string): Promise<IConnection>;
    setQueryParams(queryParams: IStringDictionary<string>, config: RecognizerConfig, endpointUrl: string): void;
}
