import { ObjectExt } from '../util/ObjectsExt.js';
const AudioPlayerWorkletUrl = new URL('./AudioPlayerProcessor.worklet.js', import.meta.url).toString();

export class AudioPlayer {
    constructor() {
        this.onAudioPlayedListeners = [];
        this.initialized = false;
    }

    addEventListener(event, callback) {
        switch (event) {
            case "onAudioPlayed":
                this.onAudioPlayedListeners.push(callback);
                break;
            default:
                console.error("Listener registered for event type: " + JSON.stringify(event) + " which is not supported");
        }
    }

    async start() {
        this.audioContext = new AudioContext({ "sampleRate": 24000 });
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 512;

        // Chrome caches worklet code more aggressively, so add a nocache parameter to make sure we get the latest
        await this.audioContext.audioWorklet.addModule(AudioPlayerWorkletUrl); // + "?nocache=" + Date.now());
        this.workletNode = new AudioWorkletNode(this.audioContext, "audio-player-processor");
        this.workletNode.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        this.recorderNode = this.audioContext.createScriptProcessor(512, 1, 1);
        this.recorderNode.onaudioprocess = (event) => {
            // Pass the input along as-is
            const inputData = event.inputBuffer.getChannelData(0);
            const outputData = event.outputBuffer.getChannelData(0);
            outputData.set(inputData);
            // Notify listeners that the audio was played
            const samples = new Float32Array(outputData.length);
            samples.set(outputData);
            this.onAudioPlayedListeners.map(listener => listener(samples));
        }
        this.#maybeOverrideInitialBufferLength();
        this.initialized = true;
    }

    bargeIn() {
        this.workletNode.port.postMessage({
            type: "barge-in",
        })
    }

    stop() {
        if (ObjectExt.exists(this.audioContext)) {
            this.audioContext.close();
        }

        if (ObjectExt.exists(this.analyser)) {
            this.analyser.disconnect();
        }

        if (ObjectExt.exists(this.workletNode)) {
            this.workletNode.disconnect();
        }

        if (ObjectExt.exists(this.recorderNode)) {
            this.recorderNode.disconnect();
        }

        this.initialized = false;
        this.audioContext = null;
        this.analyser = null;
        this.workletNode = null;
        this.recorderNode = null;
    }

    #maybeOverrideInitialBufferLength() {
        // Read a user-specified initial buffer length from the URL parameters to help with tinkering
        const params = new URLSearchParams(window.location.search);
        const value = params.get("audioPlayerInitialBufferLength");
        if (value === null) {
            return;  // No override specified
        }
        const bufferLength = parseInt(value);
        if (isNaN(bufferLength)) {
            console.error("Invalid audioPlayerInitialBufferLength value:", JSON.stringify(value));
            return;
        }
        this.workletNode.port.postMessage({
            type: "initial-buffer-length",
            bufferLength: bufferLength,
        });
    }

    playAudio(samples) {
        if (!this.initialized) {
            console.error("The audio player is not initialized. Call init() before attempting to play audio.");
            return;
        }
        this.workletNode.port.postMessage({
            type: "audio",
            audioData: samples,
        });
    }

    getSamples() {
        if (!this.initialized) {
            return null;
        }
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteTimeDomainData(dataArray);
        return [...dataArray].map(e => e / 128 - 1);
    }

    getVolume() {
        if (!this.initialized) {
            return 0;
        }
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteTimeDomainData(dataArray);
        let normSamples = [...dataArray].map(e => e / 128 - 1);
        let sum = 0;
        for (let i = 0; i < normSamples.length; i++) {
            sum += normSamples[i] * normSamples[i];
        }
        return Math.sqrt(sum / normSamples.length);
    }
}

