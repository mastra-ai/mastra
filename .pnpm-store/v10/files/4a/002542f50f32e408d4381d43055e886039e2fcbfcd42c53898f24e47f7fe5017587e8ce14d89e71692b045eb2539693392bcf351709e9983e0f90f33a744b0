"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.srt = exports.webvtt = void 0;
const converters_1 = require("./converters");
const helpers_1 = require("./lib/helpers");
const parseInput = (transcription) => {
    if (!(0, converters_1.isConverter)(transcription)) {
        return new converters_1.DeepgramConverter(transcription);
    }
    return transcription;
};
const webvtt = (transcription, lineLength = 8) => {
    const output = [];
    let data = parseInput(transcription);
    // default top of file
    output.push("WEBVTT");
    output.push("");
    // get converter specific headers
    data.getHeaders ? output.push(data.getHeaders().join("\n")) : null;
    data.getHeaders ? output.push("") : null;
    // get the lines
    const lines = data.getLines(lineLength);
    // is speaker output required?
    const speakerLabels = "speaker" in lines[0][0];
    lines.forEach((words) => {
        const firstWord = words[0];
        const lastWord = words[words.length - 1];
        output.push(`${(0, helpers_1.secondsToTimestamp)(firstWord.start)} --> ${(0, helpers_1.secondsToTimestamp)(lastWord.end)}`);
        const line = words.map((word) => { var _a; return (_a = word.punctuated_word) !== null && _a !== void 0 ? _a : word.word; }).join(" ");
        const speakerLabel = speakerLabels ? `<v Speaker ${firstWord.speaker}>` : "";
        output.push(`${speakerLabel}${line}`);
        output.push("");
    });
    return output.join("\n");
};
exports.webvtt = webvtt;
const srt = (transcription, lineLength = 8) => {
    const output = [];
    const data = parseInput(transcription);
    // get the lines
    let lines = data.getLines(lineLength);
    // is speaker output required?
    const speakerLabels = "speaker" in lines[0][0];
    let entry = 1;
    let currentSpeaker;
    lines.forEach((words) => {
        output.push((entry++).toString());
        const firstWord = words[0];
        const lastWord = words[words.length - 1];
        output.push(`${(0, helpers_1.secondsToTimestamp)(firstWord.start, "HH:mm:ss,SSS")} --> ${(0, helpers_1.secondsToTimestamp)(lastWord.end, "HH:mm:ss,SSS")}`);
        const line = words.map((word) => { var _a; return (_a = word.punctuated_word) !== null && _a !== void 0 ? _a : word.word; }).join(" ");
        const speakerLabel = speakerLabels && currentSpeaker !== firstWord.speaker
            ? `[Speaker ${firstWord.speaker}]\n`
            : "";
        output.push(`${speakerLabel}${line}`);
        output.push("");
        currentSpeaker = firstWord.speaker;
    });
    return output.join("\n");
};
exports.srt = srt;
/**
 * Helpful exports.
 */
__exportStar(require("./converters"), exports);
__exportStar(require("./lib/types"), exports);
__exportStar(require("./lib/helpers"), exports);
//# sourceMappingURL=index.js.map