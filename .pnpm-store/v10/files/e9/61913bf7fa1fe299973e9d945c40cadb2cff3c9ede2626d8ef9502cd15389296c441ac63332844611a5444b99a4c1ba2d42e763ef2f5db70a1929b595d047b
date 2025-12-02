import { Stream } from "../common/Exports";
import { IRecorder } from "./IRecorder";
export declare class PcmRecorder implements IRecorder {
    private privMediaResources;
    private privSpeechProcessorScript;
    private privStopInputOnRelease;
    constructor(stopInputOnRelease: boolean);
    record(context: AudioContext, mediaStream: MediaStream, outputStream: Stream<ArrayBuffer>): void;
    releaseMediaResources(context: AudioContext): void;
    setWorkletUrl(url: string): void;
}
