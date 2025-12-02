import { IConnection } from "../common/Exports.js";
import { AuthInfo } from "./IAuthentication.js";
import { RecognizerConfig } from "./RecognizerConfig.js";
export interface IConnectionFactory {
    create(config: RecognizerConfig, authInfo: AuthInfo, connectionId?: string): Promise<IConnection>;
}
