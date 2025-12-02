import { chunkArray } from "../lib/helpers";
export class DeepgramConverter {
    constructor(transcriptionData) {
        this.transcriptionData = transcriptionData;
    }
    getLines(lineLength = 8) {
        const { results } = this.transcriptionData;
        let content = [];
        if (results.utterances) {
            results.utterances.forEach((utterance) => {
                if (utterance.words.length > lineLength) {
                    content.push(...chunkArray(utterance.words, lineLength));
                }
                else {
                    content.push(utterance.words);
                }
            });
        }
        else {
            const words = results.channels[0].alternatives[0].words;
            const diarize = "speaker" in words[0]; // was diarization used
            let buffer = [];
            let currentSpeaker = 0;
            words.forEach((word) => {
                var _a;
                if (diarize && word.speaker !== currentSpeaker) {
                    content.push(buffer);
                    buffer = [];
                }
                if (buffer.length === lineLength) {
                    content.push(buffer);
                    buffer = [];
                }
                if (diarize) {
                    currentSpeaker = (_a = word.speaker) !== null && _a !== void 0 ? _a : 0;
                }
                buffer.push(word);
            });
            content.push(buffer);
        }
        return content;
    }
    getHeaders() {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const output = [];
        output.push("NOTE");
        output.push("Transcription provided by Deepgram");
        ((_a = this.transcriptionData.metadata) === null || _a === void 0 ? void 0 : _a.request_id)
            ? output.push(`Request Id: ${(_b = this.transcriptionData.metadata) === null || _b === void 0 ? void 0 : _b.request_id}`)
            : null;
        ((_c = this.transcriptionData.metadata) === null || _c === void 0 ? void 0 : _c.created)
            ? output.push(`Created: ${(_d = this.transcriptionData.metadata) === null || _d === void 0 ? void 0 : _d.created}`)
            : null;
        ((_e = this.transcriptionData.metadata) === null || _e === void 0 ? void 0 : _e.duration)
            ? output.push(`Duration: ${(_f = this.transcriptionData.metadata) === null || _f === void 0 ? void 0 : _f.duration}`)
            : null;
        ((_g = this.transcriptionData.metadata) === null || _g === void 0 ? void 0 : _g.channels)
            ? output.push(`Channels: ${(_h = this.transcriptionData.metadata) === null || _h === void 0 ? void 0 : _h.channels}`)
            : null;
        return output;
    }
}
//# sourceMappingURL=DeepgramConverter.js.map