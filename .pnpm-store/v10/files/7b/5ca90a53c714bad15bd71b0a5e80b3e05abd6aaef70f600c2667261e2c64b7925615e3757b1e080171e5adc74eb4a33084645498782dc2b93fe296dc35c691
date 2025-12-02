import { IConnection } from "../common/Exports.js";
import { ConnectionFactoryBase } from "./ConnectionFactoryBase.js";
import { AuthInfo, RecognizerConfig } from "./Exports.js";
declare class SpeakerRecognitionConnectionFactoryBase extends ConnectionFactoryBase {
    create(config: RecognizerConfig, authInfo: AuthInfo, endpointPath: string, connectionId?: string): Promise<IConnection>;
    private scenarioToPath;
}
export declare class SpeakerRecognitionConnectionFactory extends SpeakerRecognitionConnectionFactoryBase {
    create(config: RecognizerConfig, authInfo: AuthInfo, connectionId?: string): Promise<IConnection>;
}
export declare class VoiceProfileConnectionFactory extends SpeakerRecognitionConnectionFactoryBase {
    create(config: RecognizerConfig, authInfo: AuthInfo, connectionId?: string): Promise<IConnection>;
}
export {};
