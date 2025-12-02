"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeakerAudioDestination = void 0;
const Exports_js_1 = require("../../common/Exports.js");
const AudioOutputStream_js_1 = require("./AudioOutputStream.js");
const AudioStreamFormat_js_1 = require("./AudioStreamFormat.js");
const MediaDurationPlaceholderSeconds = 60 * 30;
const AudioFormatToMimeType = {
    [AudioStreamFormat_js_1.AudioFormatTag.PCM]: "audio/wav",
    [AudioStreamFormat_js_1.AudioFormatTag.MuLaw]: "audio/x-wav",
    [AudioStreamFormat_js_1.AudioFormatTag.MP3]: "audio/mpeg",
    [AudioStreamFormat_js_1.AudioFormatTag.OGG_OPUS]: "audio/ogg",
    [AudioStreamFormat_js_1.AudioFormatTag.WEBM_OPUS]: "audio/webm; codecs=opus",
    [AudioStreamFormat_js_1.AudioFormatTag.ALaw]: "audio/x-wav",
    [AudioStreamFormat_js_1.AudioFormatTag.FLAC]: "audio/flac",
    [AudioStreamFormat_js_1.AudioFormatTag.AMR_WB]: "audio/amr-wb",
    [AudioStreamFormat_js_1.AudioFormatTag.G722]: "audio/G722",
};
/**
 * Represents the speaker playback audio destination, which only works in browser.
 * Note: the SDK will try to use <a href="https://www.w3.org/TR/media-source/">Media Source Extensions</a> to play audio.
 * Mp3 format has better supports on Microsoft Edge, Chrome and Safari (desktop), so, it's better to specify mp3 format for playback.
 * @class SpeakerAudioDestination
 * Updated in version 1.17.0
 */
class SpeakerAudioDestination {
    constructor(audioDestinationId) {
        this.privPlaybackStarted = false;
        this.privAppendingToBuffer = false;
        this.privMediaSourceOpened = false;
        this.privBytesReceived = 0;
        this.privId = audioDestinationId ? audioDestinationId : (0, Exports_js_1.createNoDashGuid)();
        this.privIsPaused = false;
        this.privIsClosed = false;
    }
    id() {
        return this.privId;
    }
    write(buffer, cb, err) {
        if (this.privAudioBuffer !== undefined) {
            this.privAudioBuffer.push(buffer);
            this.updateSourceBuffer().then(() => {
                if (!!cb) {
                    cb();
                }
            }, (error) => {
                if (!!err) {
                    err(error);
                }
            });
        }
        else if (this.privAudioOutputStream !== undefined) {
            this.privAudioOutputStream.write(buffer);
            this.privBytesReceived += buffer.byteLength;
        }
    }
    close(cb, err) {
        this.privIsClosed = true;
        if (this.privSourceBuffer !== undefined) {
            this.handleSourceBufferUpdateEnd().then(() => {
                if (!!cb) {
                    cb();
                }
            }, (error) => {
                if (!!err) {
                    err(error);
                }
            });
        }
        else if (this.privAudioOutputStream !== undefined && typeof window !== "undefined") {
            if ((this.privFormat.formatTag === AudioStreamFormat_js_1.AudioFormatTag.PCM || this.privFormat.formatTag === AudioStreamFormat_js_1.AudioFormatTag.MuLaw
                || this.privFormat.formatTag === AudioStreamFormat_js_1.AudioFormatTag.ALaw) && this.privFormat.hasHeader === false) {
                // eslint-disable-next-line no-console
                console.warn("Play back is not supported for raw PCM, mulaw or alaw format without header.");
                if (!!this.onAudioEnd) {
                    this.onAudioEnd(this);
                }
            }
            else {
                let receivedAudio = new ArrayBuffer(this.privBytesReceived);
                this.privAudioOutputStream.read(receivedAudio).then(() => {
                    receivedAudio = this.privFormat.addHeader(receivedAudio);
                    const audioBlob = new Blob([receivedAudio], { type: AudioFormatToMimeType[this.privFormat.formatTag] });
                    this.privAudio.src = window.URL.createObjectURL(audioBlob);
                    this.notifyPlayback().then(() => {
                        if (!!cb) {
                            cb();
                        }
                    }, (error) => {
                        if (!!err) {
                            err(error);
                        }
                    });
                }, (error) => {
                    if (!!err) {
                        err(error);
                    }
                });
            }
        }
        else {
            // unsupported format, call onAudioEnd directly.
            if (!!this.onAudioEnd) {
                this.onAudioEnd(this);
            }
        }
    }
    set format(format) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (typeof (AudioContext) !== "undefined" || (typeof (window) !== "undefined" && typeof (window.webkitAudioContext) !== "undefined")) {
            this.privFormat = format;
            const mimeType = AudioFormatToMimeType[this.privFormat.formatTag];
            if (mimeType === undefined) {
                // eslint-disable-next-line no-console
                console.warn(`Unknown mimeType for format ${AudioStreamFormat_js_1.AudioFormatTag[this.privFormat.formatTag]}; playback is not supported.`);
            }
            else if (typeof (MediaSource) !== "undefined" && MediaSource.isTypeSupported(mimeType)) {
                this.privAudio = new Audio();
                this.privAudioBuffer = [];
                this.privMediaSource = new MediaSource();
                this.privAudio.src = URL.createObjectURL(this.privMediaSource);
                this.privAudio.load();
                this.privMediaSource.onsourceopen = () => {
                    this.privMediaSourceOpened = true;
                    this.privMediaSource.duration = MediaDurationPlaceholderSeconds;
                    this.privSourceBuffer = this.privMediaSource.addSourceBuffer(mimeType);
                    this.privSourceBuffer.onupdate = () => {
                        this.updateSourceBuffer().catch((reason) => {
                            Exports_js_1.Events.instance.onEvent(new Exports_js_1.BackgroundEvent(reason));
                        });
                    };
                    this.privSourceBuffer.onupdateend = () => {
                        this.handleSourceBufferUpdateEnd().catch((reason) => {
                            Exports_js_1.Events.instance.onEvent(new Exports_js_1.BackgroundEvent(reason));
                        });
                    };
                    this.privSourceBuffer.onupdatestart = () => {
                        this.privAppendingToBuffer = false;
                    };
                };
                this.updateSourceBuffer().catch((reason) => {
                    Exports_js_1.Events.instance.onEvent(new Exports_js_1.BackgroundEvent(reason));
                });
            }
            else {
                // eslint-disable-next-line no-console
                console.warn(`Format ${AudioStreamFormat_js_1.AudioFormatTag[this.privFormat.formatTag]} could not be played by MSE, streaming playback is not enabled.`);
                this.privAudioOutputStream = new AudioOutputStream_js_1.PullAudioOutputStreamImpl();
                this.privAudioOutputStream.format = this.privFormat;
                this.privAudio = new Audio();
            }
        }
    }
    get volume() {
        return this.privAudio?.volume ?? -1;
    }
    set volume(volume) {
        if (!!this.privAudio) {
            this.privAudio.volume = volume;
        }
    }
    mute() {
        if (!!this.privAudio) {
            this.privAudio.muted = true;
        }
    }
    unmute() {
        if (!!this.privAudio) {
            this.privAudio.muted = false;
        }
    }
    get isClosed() {
        return this.privIsClosed;
    }
    get currentTime() {
        if (this.privAudio !== undefined) {
            return this.privAudio.currentTime;
        }
        return -1;
    }
    pause() {
        if (!this.privIsPaused && this.privAudio !== undefined) {
            this.privAudio.pause();
            this.privIsPaused = true;
        }
    }
    resume(cb, err) {
        if (this.privIsPaused && this.privAudio !== undefined) {
            this.privAudio.play().then(() => {
                if (!!cb) {
                    cb();
                }
            }, (error) => {
                if (!!err) {
                    err(error);
                }
            });
            this.privIsPaused = false;
        }
    }
    get internalAudio() {
        return this.privAudio;
    }
    async updateSourceBuffer() {
        if (this.privAudioBuffer !== undefined && (this.privAudioBuffer.length > 0) && this.sourceBufferAvailable()) {
            this.privAppendingToBuffer = true;
            const binary = this.privAudioBuffer.shift();
            try {
                this.privSourceBuffer.appendBuffer(binary);
            }
            catch (error) {
                this.privAudioBuffer.unshift(binary);
                // eslint-disable-next-line no-console
                console.log("buffer filled, pausing addition of binaries until space is made");
                return;
            }
            await this.notifyPlayback();
        }
        else if (this.canEndStream()) {
            await this.handleSourceBufferUpdateEnd();
        }
    }
    async handleSourceBufferUpdateEnd() {
        if (this.canEndStream() && this.sourceBufferAvailable()) {
            this.privMediaSource.endOfStream();
            await this.notifyPlayback();
        }
    }
    async notifyPlayback() {
        if (!this.privPlaybackStarted && this.privAudio !== undefined) {
            this.privPlaybackStarted = true;
            if (!!this.onAudioStart) {
                this.onAudioStart(this);
            }
            this.privAudio.onended = () => {
                if (!!this.onAudioEnd) {
                    this.onAudioEnd(this);
                }
            };
            if (!this.privIsPaused) {
                await this.privAudio.play();
            }
        }
    }
    canEndStream() {
        return (this.isClosed && this.privSourceBuffer !== undefined && (this.privAudioBuffer.length === 0)
            && this.privMediaSourceOpened && !this.privAppendingToBuffer && this.privMediaSource.readyState === "open");
    }
    sourceBufferAvailable() {
        return (this.privSourceBuffer !== undefined && !this.privSourceBuffer.updating);
    }
}
exports.SpeakerAudioDestination = SpeakerAudioDestination;

//# sourceMappingURL=SpeakerAudioDestination.js.map
