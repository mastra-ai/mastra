"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
// Multi-device Conversation is a Preview feature.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Participant = exports.User = void 0;
/* eslint-disable max-classes-per-file */
const Exports_js_1 = require("../Exports.js");
class User {
    constructor(userId) {
        this.privUserId = userId;
    }
    get userId() {
        return this.privUserId;
    }
}
exports.User = User;
class Participant {
    constructor(id, avatar, displayName, isHost, isMuted, isUsingTts, preferredLanguage, voice) {
        this.privId = id;
        this.privAvatar = avatar;
        this.privDisplayName = displayName;
        this.privIsHost = isHost;
        this.privIsMuted = isMuted;
        this.privIsUsingTts = isUsingTts;
        this.privPreferredLanguage = preferredLanguage;
        this.privVoice = voice;
        this.privProperties = new Exports_js_1.PropertyCollection();
    }
    get avatar() {
        return this.privAvatar;
    }
    get displayName() {
        return this.privDisplayName;
    }
    get id() {
        return this.privId;
    }
    get preferredLanguage() {
        return this.privPreferredLanguage;
    }
    get isHost() {
        return this.privIsHost;
    }
    get isMuted() {
        return this.privIsMuted;
    }
    get isUsingTts() {
        return this.privIsUsingTts;
    }
    get voice() {
        return this.privVoice;
    }
    get properties() {
        return this.privProperties;
    }
    static From(id, language, voice) {
        return new Participant(id, "", id, false, false, false, language, voice);
    }
}
exports.Participant = Participant;

//# sourceMappingURL=IParticipant.js.map
