import { AudioStreamFormat } from "../sdk/Exports.js";
export interface IAudioDestination {
    id(): string;
    write(buffer: ArrayBuffer): void;
    format: AudioStreamFormat;
    close(cb?: () => void, err?: (error: string) => void): void;
}
