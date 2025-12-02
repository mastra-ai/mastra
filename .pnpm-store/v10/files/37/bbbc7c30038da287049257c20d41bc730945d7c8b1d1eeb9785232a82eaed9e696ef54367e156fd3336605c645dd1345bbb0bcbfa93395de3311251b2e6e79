import { AudioOutputFormatImpl } from "../sdk/Audio/AudioOutputFormat.js";
import { SpeechSynthesizer } from "../sdk/Exports.js";
/**
 * Represents the JSON used in the synthesis.context message sent to the speech service.
 * The dynamic grammar is always refreshed from the encapsulated dynamic grammar object.
 */
export declare class SynthesisContext {
    private privContext;
    private privAudioOutputFormat;
    /**
     * Adds a section to the synthesis.context object.
     * @param sectionName Name of the section to add.
     * @param value JSON serializable object that represents the value.
     */
    setSection(sectionName: string, value: string | object): void;
    /**
     * Sets the audio output format for synthesis context generation.
     * @param format {AudioOutputFormatImpl} the output format
     */
    set audioOutputFormat(format: AudioOutputFormatImpl);
    toJSON(): string;
    setSynthesisSection(speechSynthesizer: SpeechSynthesizer): void;
    private buildSynthesisContext;
}
