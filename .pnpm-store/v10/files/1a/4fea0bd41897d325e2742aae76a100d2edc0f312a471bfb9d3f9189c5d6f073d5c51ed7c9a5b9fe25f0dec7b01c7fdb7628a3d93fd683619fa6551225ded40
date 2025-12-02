import { AudioStreamFormat } from "../Exports.js";
/**
 * Base audio player class
 * TODO: Plays only PCM for now.
 * @class
 */
export declare class BaseAudioPlayer {
    private audioContext;
    private gainNode;
    private audioFormat;
    private autoUpdateBufferTimer;
    private samples;
    private startTime;
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {AudioStreamFormat} audioFormat audio stream format recognized by the player.
     */
    constructor(audioFormat?: AudioStreamFormat);
    /**
     * play Audio sample
     * @param newAudioData audio data to be played.
     */
    playAudioSample(newAudioData: ArrayBuffer, cb?: () => void, err?: (error: string) => void): void;
    /**
     * stops audio and clears the buffers
     */
    stopAudio(cb?: () => void, err?: (error: string) => void): void;
    private init;
    private ensureInitializedContext;
    private createAudioContext;
    private formatAudioData;
    private formatArrayBuffer;
    private updateAudioBuffer;
    private playAudio;
}
