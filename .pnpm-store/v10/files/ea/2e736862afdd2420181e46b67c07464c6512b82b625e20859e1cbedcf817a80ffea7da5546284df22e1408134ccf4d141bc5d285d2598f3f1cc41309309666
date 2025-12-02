import { IConnection } from "../common/Exports.js";
import { AuthInfo } from "./IAuthentication.js";
import { SynthesizerConfig } from "./SynthesizerConfig.js";
export interface ISynthesisConnectionFactory {
    create(config: SynthesizerConfig, authInfo: AuthInfo, connectionId?: string): Promise<IConnection>;
}
