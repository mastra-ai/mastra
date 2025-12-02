import { IConnection, IStringDictionary } from "../common/Exports.js";
import { PropertyId } from "../sdk/Exports.js";
import { AuthInfo, IConnectionFactory, RecognizerConfig } from "./Exports.js";
export declare abstract class ConnectionFactoryBase implements IConnectionFactory {
    static getHostSuffix(region: string): string;
    abstract create(config: RecognizerConfig, authInfo: AuthInfo, connectionId?: string): Promise<IConnection>;
    protected setCommonUrlParams(config: RecognizerConfig, queryParams: IStringDictionary<string>, endpoint: string): void;
    protected setUrlParameter(propId: PropertyId, parameterName: string, config: RecognizerConfig, queryParams: IStringDictionary<string>, endpoint: string): void;
    static getRedirectUrlFromEndpoint(endpoint: string): Promise<string>;
}
