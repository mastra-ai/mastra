import { IConnection, IStringDictionary } from "../common/Exports.js";
import { ConnectionFactoryBase } from "./ConnectionFactoryBase.js";
import { AuthInfo, RecognizerConfig } from "./Exports.js";
export declare class TranslationConnectionFactory extends ConnectionFactoryBase {
    private readonly universalUri;
    private readonly translationV1Uri;
    create(config: RecognizerConfig, authInfo: AuthInfo, connectionId?: string): Promise<IConnection>;
    getEndpointUrl(config: RecognizerConfig, returnRegionPlaceholder?: boolean): string;
    setQueryParams(queryParams: IStringDictionary<string>, config: RecognizerConfig, endpointUrl: string): void;
}
