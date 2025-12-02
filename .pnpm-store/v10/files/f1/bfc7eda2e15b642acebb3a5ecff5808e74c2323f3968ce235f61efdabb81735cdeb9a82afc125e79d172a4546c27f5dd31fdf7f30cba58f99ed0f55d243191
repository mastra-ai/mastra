import { chunkArray } from "../lib/helpers";
import { WordBase } from "../lib/types";
import { IConverter } from "./IConverter";

const wordMap = (word: any): WordBase => {
  return {
    word: word.text,
    start: word.start,
    end: word.end,
    confidence: word.confidence,
    punctuated_word: word.text,
    speaker: word.speaker,
  };
};

export class AssemblyAiConverter implements IConverter {
  constructor(public transcriptionData: any) {}

  getLines(lineLength: number = 8): WordBase[][] {
    const results = this.transcriptionData;
    let content: WordBase[][] = [];

    if (results.utterances) {
      results.utterances.forEach((utterance: any) => {
        if (utterance.words.length > lineLength) {
          content.push(
            ...chunkArray(
              utterance.words.map((w: any) => wordMap(w)),
              lineLength
            )
          );
        } else {
          content.push(utterance.words.map((w: any) => wordMap(w)));
        }
      });
    } else {
      content.push(
        ...chunkArray(
          results.words.map((w: any) => wordMap(w)),
          lineLength
        )
      );
    }

    return content;
  }

  getHeaders(): string[] {
    const output: string[] = [];

    output.push("NOTE");
    output.push("Transcription provided by Assembly AI");
    this.transcriptionData.id ? output.push(`Id: ${this.transcriptionData.id}`) : null;
    this.transcriptionData.audio_duration
      ? output.push(`Duration: ${this.transcriptionData.audio_duration}`)
      : null;

    return output;
  }
}
