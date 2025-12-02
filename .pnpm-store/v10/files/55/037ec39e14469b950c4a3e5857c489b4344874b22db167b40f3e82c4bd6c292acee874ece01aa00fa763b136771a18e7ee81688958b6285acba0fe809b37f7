import { ISpeechConfigAudioDevice } from "../common.speech/Exports.js";
import { AudioStreamFormatImpl } from "../sdk/Audio/AudioStreamFormat.js";
import { AudioSourceEvent } from "./AudioSourceEvents.js";
import { EventSource } from "./EventSource.js";
import { IDetachable } from "./IDetachable.js";
import { IStreamChunk } from "./Stream.js";
export interface IAudioSource {
    id(): string;
    turnOn(): Promise<void>;
    attach(audioNodeId: string): Promise<IAudioStreamNode>;
    detach(audioNodeId: string): void;
    turnOff(): Promise<void>;
    events: EventSource<AudioSourceEvent>;
    format: Promise<AudioStreamFormatImpl>;
    deviceInfo: Promise<ISpeechConfigAudioDevice>;
    setProperty?(name: string, value: string): void;
    getProperty?(name: string, def?: string): string;
}
export interface IAudioStreamNode extends IDetachable {
    id(): string;
    read(): Promise<IStreamChunk<ArrayBuffer>>;
}
