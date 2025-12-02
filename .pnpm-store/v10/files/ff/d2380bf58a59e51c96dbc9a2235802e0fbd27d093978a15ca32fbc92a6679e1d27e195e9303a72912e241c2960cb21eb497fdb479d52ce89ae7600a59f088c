"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceInfo = exports.SynthesisVoiceType = exports.SynthesisVoiceGender = void 0;
/**
 * Defines the gender of synthesis voices.
 * Added in version 1.20.0.
 */
var SynthesisVoiceGender;
(function (SynthesisVoiceGender) {
    /** Gender unknown */
    SynthesisVoiceGender[SynthesisVoiceGender["Unknown"] = 0] = "Unknown";
    /** Female voice */
    SynthesisVoiceGender[SynthesisVoiceGender["Female"] = 1] = "Female";
    /** Male voice */
    SynthesisVoiceGender[SynthesisVoiceGender["Male"] = 2] = "Male";
    /** Neutral voice */
    SynthesisVoiceGender[SynthesisVoiceGender["Neutral"] = 3] = "Neutral";
})(SynthesisVoiceGender = exports.SynthesisVoiceGender || (exports.SynthesisVoiceGender = {}));
var SynthesisVoiceType;
(function (SynthesisVoiceType) {
    /**
     * Voice type is not known.
     */
    SynthesisVoiceType[SynthesisVoiceType["Unknown"] = 0] = "Unknown";
    /**
     * Online neural voices.
     */
    SynthesisVoiceType[SynthesisVoiceType["OnlineNeural"] = 1] = "OnlineNeural";
    /**
     * Online standard voices. These voices are deprecated.
     */
    SynthesisVoiceType[SynthesisVoiceType["OnlineStandard"] = 2] = "OnlineStandard";
    /**
     * Offline neural voices.
     */
    SynthesisVoiceType[SynthesisVoiceType["OfflineNeural"] = 3] = "OfflineNeural";
    /**
     * Offline standard voices.
     */
    SynthesisVoiceType[SynthesisVoiceType["OfflineStandard"] = 4] = "OfflineStandard";
    /**
     * High definition (HD) voices. Refer to https://learn.microsoft.com/azure/ai-services/speech-service/high-definition-voices
     */
    SynthesisVoiceType[SynthesisVoiceType["OnlineNeuralHD"] = 5] = "OnlineNeuralHD";
})(SynthesisVoiceType = exports.SynthesisVoiceType || (exports.SynthesisVoiceType = {}));
const GENDER_LOOKUP = {
    [SynthesisVoiceGender[SynthesisVoiceGender.Neutral]]: SynthesisVoiceGender.Neutral,
    [SynthesisVoiceGender[SynthesisVoiceGender.Male]]: SynthesisVoiceGender.Male,
    [SynthesisVoiceGender[SynthesisVoiceGender.Female]]: SynthesisVoiceGender.Female,
};
const VOICE_TYPE_LOOKUP = {
    Neural: SynthesisVoiceType.OnlineNeural,
    NeuralHD: SynthesisVoiceType.OnlineNeuralHD,
};
/**
 * Information about Speech Synthesis voice
 * Added in version 1.20.0.
 * @class VoiceInfo
 */
class VoiceInfo {
    constructor(json) {
        this.privStyleList = [];
        if (!!json) {
            this.privName = json.Name;
            this.privLocale = json.Locale;
            this.privShortName = json.ShortName;
            this.privLocaleName = json.LocaleName;
            this.privDisplayName = json.DisplayName;
            this.privLocalName = json.LocalName;
            this.privVoiceType = VOICE_TYPE_LOOKUP[json.VoiceType] || SynthesisVoiceType.Unknown;
            this.privGender = GENDER_LOOKUP[json.Gender] || SynthesisVoiceGender.Unknown;
            if (!!json.StyleList && Array.isArray(json.StyleList)) {
                for (const style of json.StyleList) {
                    this.privStyleList.push(style);
                }
            }
            this.privSampleRateHertz = json.SampleRateHertz;
            this.privStatus = json.Status;
            if (json.ExtendedPropertyMap) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                this.privExtendedPropertyMap = json.ExtendedPropertyMap;
            }
            this.privWordsPerMinute = json.WordsPerMinute;
            if (Array.isArray(json.SecondaryLocaleList)) {
                this.privSecondaryLocaleList = [...json.SecondaryLocaleList];
            }
            if (Array.isArray(json.RolePlayList)) {
                this.privRolePlayList = [...json.RolePlayList];
            }
            if (json.VoiceTag) {
                this.privVoiceTag = json.VoiceTag;
            }
        }
    }
    get name() {
        return this.privName;
    }
    get locale() {
        return this.privLocale;
    }
    get shortName() {
        return this.privShortName;
    }
    get displayName() {
        return this.privDisplayName;
    }
    get localName() {
        return this.privLocalName;
    }
    get localeName() {
        return this.privLocaleName;
    }
    get gender() {
        return this.privGender;
    }
    get voiceType() {
        return this.privVoiceType;
    }
    get styleList() {
        return this.privStyleList;
    }
    get sampleRateHertz() {
        return this.privSampleRateHertz;
    }
    get status() {
        return this.privStatus;
    }
    get extendedPropertyMap() {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return this.privExtendedPropertyMap;
    }
    get wordsPerMinute() {
        return this.privWordsPerMinute;
    }
    get secondaryLocaleList() {
        return this.privSecondaryLocaleList;
    }
    get rolePlayList() {
        return this.privRolePlayList;
    }
    get voiceTag() {
        return this.privVoiceTag;
    }
}
exports.VoiceInfo = VoiceInfo;

//# sourceMappingURL=VoiceInfo.js.map
