"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeakerIdentificationModel = void 0;
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_1 = require("./Exports.js");
/**
 * Defines SpeakerIdentificationModel class for Speaker Recognition
 * Model contains a set of profiles against which to identify speaker(s)
 * @class SpeakerIdentificationModel
 */
class SpeakerIdentificationModel {
    constructor(profiles) {
        this.privVoiceProfiles = [];
        this.privProfileIds = [];
        Contracts_js_1.Contracts.throwIfNullOrUndefined(profiles, "VoiceProfiles");
        if (profiles.length === 0) {
            throw new Error("Empty Voice Profiles array");
        }
        for (const profile of profiles) {
            if (profile.profileType !== Exports_js_1.VoiceProfileType.TextIndependentIdentification) {
                throw new Error("Identification model can only be created from Identification profile: " + profile.profileId);
            }
            this.privVoiceProfiles.push(profile);
            this.privProfileIds.push(profile.profileId);
        }
    }
    static fromProfiles(profiles) {
        return new SpeakerIdentificationModel(profiles);
    }
    get voiceProfileIds() {
        return this.privProfileIds.join(",");
    }
    get profileIds() {
        return this.privProfileIds;
    }
    get scenario() {
        return "TextIndependentIdentification";
    }
}
exports.SpeakerIdentificationModel = SpeakerIdentificationModel;

//# sourceMappingURL=SpeakerIdentificationModel.js.map
