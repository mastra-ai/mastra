/**
 * Represents audio player interface to control the audio playback, such as pause, resume, etc.
 * @interface IPlayer
 * Added in version 1.12.0
 */
export interface IPlayer {
    /**
     * Pauses the audio playing
     * @member IPlayer.pause
     * @function
     * @public
     */
    pause(): void;
    /**
     * Resumes the audio playing
     * @member IPlayer.resume
     * @function
     * @public
     */
    resume(cb?: () => void, err?: (error: string) => void): void;
    /**
     * Defines event handler audio playback start event.
     * @member IPlayer.prototype.onAudioStart
     * @function
     * @public
     */
    onAudioStart: (sender: IPlayer) => void;
    /**
     * Defines event handler audio playback end event.
     * @member IPlayer.prototype.onAudioEnd
     * @function
     * @public
     */
    onAudioEnd: (sender: IPlayer) => void;
    /**
     * Gets the current play audio offset.
     * @member IPlayer.prototype.currentTime
     * @function
     * @public
     * @returns {number} The current play audio offset, in second
     */
    currentTime: number;
}
