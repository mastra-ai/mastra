import { AvatarConfig, AvatarSynthesizer } from "../sdk/Exports.js";
import { ISynthesisConnectionFactory, ISynthesisMetadata, SynthesisAdapterBase, SynthesizerConfig } from "./Exports.js";
import { IAuthentication } from "./IAuthentication.js";
export declare class AvatarSynthesisAdapter extends SynthesisAdapterBase {
    private readonly privAvatarSynthesizer;
    private readonly privAvatarConfig;
    constructor(authentication: IAuthentication, connectionFactory: ISynthesisConnectionFactory, synthesizerConfig: SynthesizerConfig, avatarSynthesizer: AvatarSynthesizer, avatarConfig: AvatarConfig);
    protected setSynthesisContextSynthesisSection(): void;
    protected setSpeechConfigSynthesisSection(): void;
    protected onAvatarEvent(metadata: ISynthesisMetadata): void;
}
