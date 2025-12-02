"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssemblyAiConverter = void 0;
const helpers_1 = require("../lib/helpers");
const wordMap = (word) => {
    return {
        word: word.text,
        start: word.start,
        end: word.end,
        confidence: word.confidence,
        punctuated_word: word.text,
        speaker: word.speaker,
    };
};
class AssemblyAiConverter {
    constructor(transcriptionData) {
        this.transcriptionData = transcriptionData;
    }
    getLines(lineLength = 8) {
        const results = this.transcriptionData;
        let content = [];
        if (results.utterances) {
            results.utterances.forEach((utterance) => {
                if (utterance.words.length > lineLength) {
                    content.push(...(0, helpers_1.chunkArray)(utterance.words.map((w) => wordMap(w)), lineLength));
                }
                else {
                    content.push(utterance.words.map((w) => wordMap(w)));
                }
            });
        }
        else {
            content.push(...(0, helpers_1.chunkArray)(results.words.map((w) => wordMap(w)), lineLength));
        }
        return content;
    }
    getHeaders() {
        const output = [];
        output.push("NOTE");
        output.push("Transcription provided by Assembly AI");
        this.transcriptionData.id ? output.push(`Id: ${this.transcriptionData.id}`) : null;
        this.transcriptionData.audio_duration
            ? output.push(`Duration: ${this.transcriptionData.audio_duration}`)
            : null;
        return output;
    }
}
exports.AssemblyAiConverter = AssemblyAiConverter;
//# sourceMappingURL=AssemblyAiConverter.js.map