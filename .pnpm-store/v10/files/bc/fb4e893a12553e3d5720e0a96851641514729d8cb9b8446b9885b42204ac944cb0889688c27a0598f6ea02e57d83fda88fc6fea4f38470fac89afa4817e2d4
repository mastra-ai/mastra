"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SynthesisAudioMetadata = exports.MetadataType = void 0;
var MetadataType;
(function (MetadataType) {
    MetadataType["WordBoundary"] = "WordBoundary";
    MetadataType["Bookmark"] = "Bookmark";
    MetadataType["Viseme"] = "Viseme";
    MetadataType["SentenceBoundary"] = "SentenceBoundary";
    MetadataType["SessionEnd"] = "SessionEnd";
    MetadataType["AvatarSignal"] = "TalkingAvatarSignal";
})(MetadataType = exports.MetadataType || (exports.MetadataType = {}));
class SynthesisAudioMetadata {
    constructor(json) {
        this.privSynthesisAudioMetadata = JSON.parse(json);
    }
    static fromJSON(json) {
        return new SynthesisAudioMetadata(json);
    }
    get Metadata() {
        return this.privSynthesisAudioMetadata.Metadata;
    }
}
exports.SynthesisAudioMetadata = SynthesisAudioMetadata;

//# sourceMappingURL=SynthesisAudioMetadata.js.map
