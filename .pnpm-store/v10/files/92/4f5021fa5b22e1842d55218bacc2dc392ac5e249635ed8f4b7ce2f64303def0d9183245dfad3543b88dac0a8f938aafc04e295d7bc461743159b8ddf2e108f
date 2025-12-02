import { OnError } from "./OnError";
/**
 * The json paylaod for synthesis context in speech.context
 */
export interface SynthesisContext {
    /**
     * The voices.
     */
    defaultVoices?: {
        [key: string]: string;
    };
    /**
     * The target languages for which synthesis should be generated.
     * Defaults to all, if list is omitted or empty.
     */
    synthesizedLanguages?: string[];
    /**
     * The on error.
     */
    onError?: OnError;
}
