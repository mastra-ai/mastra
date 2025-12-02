import { IAudioDestination } from "../../common/Exports.js";
import { AudioStreamFormat, IPlayer } from "../Exports.js";
/**
 * Represents the speaker playback audio destination, which only works in browser.
 * Note: the SDK will try to use <a href="https://www.w3.org/TR/media-source/">Media Source Extensions</a> to play audio.
 * Mp3 format has better supports on Microsoft Edge, Chrome and Safari (desktop), so, it's better to specify mp3 format for playback.
 * @class SpeakerAudioDestination
 * Updated in version 1.17.0
 */
export declare class SpeakerAudioDestination implements IAudioDestination, IPlayer {
    private readonly privId;
    private privFormat;
    private privAudio;
    private privMediaSource;
    private privSourceBuffer;
    private privPlaybackStarted;
    private privAudioBuffer;
    private privAppendingToBuffer;
    private privMediaSourceOpened;
    private privIsClosed;
    private privIsPaused;
    private privAudioOutputStream;
    private privBytesReceived;
    constructor(audioDestinationId?: string);
    id(): string;
    write(buffer: ArrayBuffer, cb?: () => void, err?: (error: string) => void): void;
    close(cb?: () => void, err?: (error: string) => void): void;
    set format(format: AudioStreamFormat);
    get volume(): number;
    set volume(volume: number);
    mute(): void;
    unmute(): void;
    get isClosed(): boolean;
    get currentTime(): number;
    pause(): void;
    resume(cb?: () => void, err?: (error: string) => void): void;
    onAudioStart: (sender: IPlayer) => void;
    onAudioEnd: (sender: IPlayer) => void;
    get internalAudio(): HTMLAudioElement;
    private updateSourceBuffer;
    private handleSourceBufferUpdateEnd;
    private notifyPlayback;
    private canEndStream;
    private sourceBufferAvailable;
}
