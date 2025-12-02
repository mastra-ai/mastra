import { IVoiceJson, IVoiceTag } from "./IVoiceJson";
/**
 * Defines the gender of synthesis voices.
 * Added in version 1.20.0.
 */
export declare enum SynthesisVoiceGender {
    /** Gender unknown */
    Unknown = 0,
    /** Female voice */
    Female = 1,
    /** Male voice */
    Male = 2,
    /** Neutral voice */
    Neutral = 3
}
export declare enum SynthesisVoiceType {
    /**
     * Voice type is not known.
     */
    Unknown = 0,
    /**
     * Online neural voices.
     */
    OnlineNeural = 1,
    /**
     * Online standard voices. These voices are deprecated.
     */
    OnlineStandard = 2,
    /**
     * Offline neural voices.
     */
    OfflineNeural = 3,
    /**
     * Offline standard voices.
     */
    OfflineStandard = 4,
    /**
     * High definition (HD) voices. Refer to https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices
     */
    OnlineNeuralHD = 5
}
/**
 * Information about Speech Synthesis voice
 * Added in version 1.20.0.
 * @class VoiceInfo
 */
export declare class VoiceInfo {
    private privName;
    private privLocale;
    private privShortName;
    private privDisplayName;
    private privLocalName;
    private privLocaleName;
    private privGender;
    private privVoiceType;
    private privStyleList;
    private privSampleRateHertz;
    private privStatus;
    private privExtendedPropertyMap;
    private privWordsPerMinute;
    private privSecondaryLocaleList;
    private privRolePlayList;
    private privVoiceTag;
    constructor(json: IVoiceJson);
    get name(): IVoiceJson["Name"];
    get locale(): IVoiceJson["Locale"];
    get shortName(): IVoiceJson["ShortName"];
    get displayName(): IVoiceJson["DisplayName"];
    get localName(): IVoiceJson["LocalName"];
    get localeName(): IVoiceJson["LocaleName"];
    get gender(): SynthesisVoiceGender;
    get voiceType(): SynthesisVoiceType;
    get styleList(): IVoiceJson["StyleList"];
    get sampleRateHertz(): IVoiceJson["SampleRateHertz"];
    get status(): IVoiceJson["Status"];
    get extendedPropertyMap(): IVoiceJson["ExtendedPropertyMap"];
    get wordsPerMinute(): IVoiceJson["WordsPerMinute"];
    get secondaryLocaleList(): IVoiceJson["SecondaryLocaleList"];
    get rolePlayList(): IVoiceJson["RolePlayList"];
    get voiceTag(): IVoiceTag;
}
