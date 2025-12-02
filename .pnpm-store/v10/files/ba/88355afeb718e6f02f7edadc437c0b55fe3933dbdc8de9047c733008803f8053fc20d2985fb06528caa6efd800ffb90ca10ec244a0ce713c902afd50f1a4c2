import { PropertyCollection } from "../sdk/Exports.js";
import { ISynthesisSectionVideo, SpeechServiceConfig } from "./Exports.js";
export declare enum SynthesisServiceType {
    Standard = 0,
    Custom = 1
}
export declare class SynthesizerConfig {
    private privSynthesisServiceType;
    private privSpeechServiceConfig;
    private privParameters;
    avatarEnabled: boolean;
    constructor(speechServiceConfig: SpeechServiceConfig, parameters: PropertyCollection);
    get parameters(): PropertyCollection;
    get synthesisServiceType(): SynthesisServiceType;
    set synthesisServiceType(value: SynthesisServiceType);
    set synthesisVideoSection(value: ISynthesisSectionVideo);
    get SpeechServiceConfig(): SpeechServiceConfig;
    setContextFromJson(contextJson: string | object): void;
}
