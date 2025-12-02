"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeakerVerificationModel = void 0;
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_1 = require("./Exports.js");
/**
 * Defines SpeakerVerificationModel class for Speaker Recognition
 * Model contains a profile against which to verify a speaker
 * @class SpeakerVerificationModel
 */
class SpeakerVerificationModel {
    constructor(profile) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(profile, "VoiceProfile");
        if (profile.profileType === Exports_js_1.VoiceProfileType.TextIndependentIdentification) {
            throw new Error("Verification model cannot be created from Identification profile");
        }
        this.privVoiceProfile = profile;
    }
    static fromProfile(profile) {
        return new SpeakerVerificationModel(profile);
    }
    get voiceProfile() {
        return this.privVoiceProfile;
    }
    get profileIds() {
        return [this.voiceProfile.profileId];
    }
    get scenario() {
        if (this.voiceProfile.profileType === Exports_js_1.VoiceProfileType.TextDependentVerification) {
            return "TextDependentVerification";
        }
        else {
            return "TextIndependentVerification";
        }
    }
}
exports.SpeakerVerificationModel = SpeakerVerificationModel;

//# sourceMappingURL=SpeakerVerificationModel.js.map
