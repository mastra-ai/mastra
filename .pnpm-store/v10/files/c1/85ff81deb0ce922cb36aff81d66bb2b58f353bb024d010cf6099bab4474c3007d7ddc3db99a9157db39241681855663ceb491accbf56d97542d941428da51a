"use strict";
//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE.md file in the project root for full license information.
//
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanguageIdDetectionPriority = exports.LanguageIdDetectionMode = void 0;
/**
 * The enum that represents which mode will language detection take place
 * There is only detectAtAudioStart mode for now as language detection models are not trained for different modes
 * This enum can be extended in future to support different modes
 */
var LanguageIdDetectionMode;
(function (LanguageIdDetectionMode) {
    LanguageIdDetectionMode["DetectAtAudioStart"] = "DetectAtAudioStart";
    LanguageIdDetectionMode["DetectContinuous"] = "DetectContinuous";
    LanguageIdDetectionMode["DetectSegments"] = "DetectSegments";
})(LanguageIdDetectionMode = exports.LanguageIdDetectionMode || (exports.LanguageIdDetectionMode = {}));
/**
 * The language id detection mode, setting this will load the detection setting of MaxAudioDuration and MaxSpeechDuration
 * If the maxAudioDuration and maxSpeechDuration is set in the speech.context, then this detection mode will be ignored
 */
var LanguageIdDetectionPriority;
(function (LanguageIdDetectionPriority) {
    /**
     * default, Service decides the best mode to use.
     */
    LanguageIdDetectionPriority["Auto"] = "Auto";
    /**
     * Offers lower latency via a trade-off of accuracy.
     */
    LanguageIdDetectionPriority["PrioritizeLatency"] = "PrioritizeLatency";
    /**
     * Offers higher accuracy via a trade-off of latency.
     */
    LanguageIdDetectionPriority["PrioritizeAccuracy"] = "PrioritizeAccuracy";
})(LanguageIdDetectionPriority = exports.LanguageIdDetectionPriority || (exports.LanguageIdDetectionPriority = {}));

//# sourceMappingURL=LanguageIdContext.js.map
