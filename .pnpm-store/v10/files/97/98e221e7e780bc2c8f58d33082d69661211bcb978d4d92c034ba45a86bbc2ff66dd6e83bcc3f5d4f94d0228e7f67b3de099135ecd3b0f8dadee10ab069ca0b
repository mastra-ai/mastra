import { DeepgramConverter, isConverter } from "./converters";
import { secondsToTimestamp } from "./lib/helpers";
const parseInput = (transcription) => {
    if (!isConverter(transcription)) {
        return new DeepgramConverter(transcription);
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
        output.push(`${secondsToTimestamp(firstWord.start)} --> ${secondsToTimestamp(lastWord.end)}`);
        const line = words.map((word) => { var _a; return (_a = word.punctuated_word) !== null && _a !== void 0 ? _a : word.word; }).join(" ");
        const speakerLabel = speakerLabels ? `<v Speaker ${firstWord.speaker}>` : "";
        output.push(`${speakerLabel}${line}`);
        output.push("");
    });
    return output.join("\n");
};
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
        output.push(`${secondsToTimestamp(firstWord.start, "HH:mm:ss,SSS")} --> ${secondsToTimestamp(lastWord.end, "HH:mm:ss,SSS")}`);
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
export { webvtt, srt };
/**
 * Helpful exports.
 */
export * from "./converters";
export * from "./lib/types";
export * from "./lib/helpers";
//# sourceMappingURL=index.js.map