/// <reference types="node" />
import * as fs from "fs";
import { IAudioDestination } from "../../common/Exports.js";
import { AudioStreamFormat } from "../Exports.js";
export declare class AudioFileWriter implements IAudioDestination {
    private privAudioFormat;
    private privFd;
    private privId;
    private privWriteStream;
    constructor(filename: fs.PathLike);
    set format(format: AudioStreamFormat);
    write(buffer: ArrayBuffer): void;
    close(): void;
    id(): string;
}
