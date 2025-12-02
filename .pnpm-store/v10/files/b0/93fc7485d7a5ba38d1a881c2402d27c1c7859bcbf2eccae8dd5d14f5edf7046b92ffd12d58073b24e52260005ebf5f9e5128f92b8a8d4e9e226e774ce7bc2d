import { IAudioDestination } from "../common/Exports.js";
import { SpeechSynthesisBookmarkEventArgs, SpeechSynthesisResult, SpeechSynthesisVisemeEventArgs, SpeechSynthesisWordBoundaryEventArgs, SpeechSynthesizer } from "../sdk/Exports.js";
import { IAuthentication, ISynthesisConnectionFactory, SynthesisAdapterBase, SynthesizerConfig } from "./Exports.js";
export declare class SpeechSynthesisAdapter extends SynthesisAdapterBase {
    private privSpeechSynthesizer;
    constructor(authentication: IAuthentication, connectionFactory: ISynthesisConnectionFactory, synthesizerConfig: SynthesizerConfig, speechSynthesizer: SpeechSynthesizer, audioDestination: IAudioDestination);
    protected setSynthesisContextSynthesisSection(): void;
    protected onSynthesisStarted(requestId: string): void;
    protected onSynthesizing(audio: ArrayBuffer): void;
    protected onSynthesisCancelled(result: SpeechSynthesisResult): void;
    protected onSynthesisCompleted(result: SpeechSynthesisResult): void;
    protected onWordBoundary(wordBoundaryEventArgs: SpeechSynthesisWordBoundaryEventArgs): void;
    protected onVisemeReceived(visemeEventArgs: SpeechSynthesisVisemeEventArgs): void;
    protected onBookmarkReached(bookmarkEventArgs: SpeechSynthesisBookmarkEventArgs): void;
}
