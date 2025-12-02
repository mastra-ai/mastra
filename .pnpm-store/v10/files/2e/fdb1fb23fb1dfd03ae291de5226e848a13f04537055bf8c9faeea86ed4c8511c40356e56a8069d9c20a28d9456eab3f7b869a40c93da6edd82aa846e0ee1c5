import { DeepgramConverter, IConverter, isConverter } from "./converters";
import { chunkArray, secondsToTimestamp } from "./lib/helpers";
import { DeepgramResponse } from "./lib/types";

const parseInput = (transcription: any): IConverter => {
  if (!isConverter(transcription)) {
    return new DeepgramConverter(transcription as DeepgramResponse);
  }

  return transcription;
};

const webvtt = (transcription: any, lineLength: number = 8): string => {
  const output: string[] = [];

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

    const line = words.map((word) => word.punctuated_word ?? word.word).join(" ");
    const speakerLabel = speakerLabels ? `<v Speaker ${firstWord.speaker}>` : "";

    output.push(`${speakerLabel}${line}`);
    output.push("");
  });

  return output.join("\n");
};

const srt = (transcription: any, lineLength: number = 8): string => {
  const output: string[] = [];

  const data = parseInput(transcription);

  // get the lines
  let lines = data.getLines(lineLength);

  // is speaker output required?
  const speakerLabels = "speaker" in lines[0][0];

  let entry = 1;
  let currentSpeaker: any;

  lines.forEach((words) => {
    output.push((entry++).toString());

    const firstWord = words[0];
    const lastWord = words[words.length - 1];

    output.push(
      `${secondsToTimestamp(firstWord.start, "HH:mm:ss,SSS")} --> ${secondsToTimestamp(
        lastWord.end,
        "HH:mm:ss,SSS"
      )}`
    );

    const line = words.map((word) => word.punctuated_word ?? word.word).join(" ");
    const speakerLabel =
      speakerLabels && currentSpeaker !== firstWord.speaker
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
