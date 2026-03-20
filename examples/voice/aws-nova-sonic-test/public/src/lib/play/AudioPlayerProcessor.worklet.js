// Audio sample buffer to minimize reallocations
class ExpandableBuffer {

    constructor() {
        // Start with 3 seconds' worth of buffered audio capacity before needing to expand
        // This provides more cushion for inconsistent chunk arrival times
        const initialBufferSize = 72000; // 3 seconds at 24kHz
        this.buffer = new Float32Array(initialBufferSize);
        this.readIndex = 0;
        this.writeIndex = 0;
        this.underflowedSamples = 0;
        this.isInitialBuffering = true;
        this.initialBufferLength = 36000;  // 1.5 seconds - wait for 1.5 seconds of audio before starting playback
        this.lastWriteTime = 0;
    }

    logTimeElapsedSinceLastWrite() {
        const now = Date.now();
        if (this.lastWriteTime !== 0) {
            const elapsed = now - this.lastWriteTime;
            console.log(`Elapsed time since last audio buffer write: ${elapsed} ms`);
        }
        this.lastWriteTime = now;
    }

    write(samples) {
        this.logTimeElapsedSinceLastWrite();
        if (this.writeIndex + samples.length <= this.buffer.length) {
            // Enough space to append the new samples
        }
        else {
            // Not enough space ...
            if (samples.length <= this.readIndex) {
                // ... but we can shift samples to the beginning of the buffer
                const subarray = this.buffer.subarray(this.readIndex, this.writeIndex);
                console.log(`Shifting the audio buffer of length ${subarray.length} by ${this.readIndex}`);
                this.buffer.set(subarray);
            }
            else {
                // ... and we need to grow the buffer capacity to make room for more audio
                const newLength = (samples.length + this.writeIndex - this.readIndex) * 2;
                const newBuffer = new Float32Array(newLength);
                console.log(`Expanding the audio buffer from ${this.buffer.length} to ${newLength}`);
                newBuffer.set(this.buffer.subarray(this.readIndex, this.writeIndex));
                this.buffer = newBuffer;
            }
            this.writeIndex -= this.readIndex;
            this.readIndex = 0;
        }
        this.buffer.set(samples, this.writeIndex);
        this.writeIndex += samples.length;
        if (this.writeIndex - this.readIndex >= this.initialBufferLength) {
            // Filled the initial buffer length, so we can start playback with some cushion
            this.isInitialBuffering = false;
            console.log("Initial audio buffer filled");
        }
    }

    read(destination) {
        let copyLength = 0;
        if (!this.isInitialBuffering) {
            // Only start to play audio after we've built up some initial cushion
            copyLength = Math.min(destination.length, this.writeIndex - this.readIndex);
        }
        destination.set(this.buffer.subarray(this.readIndex, this.readIndex + copyLength));
        this.readIndex += copyLength;
        if (copyLength > 0 && this.underflowedSamples > 0) {
            console.log(`Detected audio buffer underflow of ${this.underflowedSamples} samples`);
            this.underflowedSamples = 0;
        }
        if (copyLength < destination.length) {
            // Not enough samples (buffer underflow). Fill the rest with silence.
            destination.fill(0, copyLength);
            this.underflowedSamples += destination.length - copyLength;
        }
        if (copyLength === 0) {
            // Ran out of audio, so refill the buffer to the initial length before playing more
            // But only if we've been waiting for a while - don't reset on small gaps
            // This prevents choppy playback when chunks arrive with small delays
            if (this.writeIndex - this.readIndex === 0) {
                // Buffer is completely empty, need to rebuffer
                this.isInitialBuffering = true;
            }
            // If there's still some data in the buffer, keep playing (don't reset to initial buffering)
        }
    }

    clearBuffer() {
        this.readIndex = 0;
        this.writeIndex = 0;
    }
}

class AudioPlayerProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.playbackBuffer = new ExpandableBuffer();
        this.port.onmessage = (event) => {
            if (event.data.type === "audio") {
                this.playbackBuffer.write(event.data.audioData);
            }
            else if (event.data.type === "initial-buffer-length") {
                // Override the current playback initial buffer length
                const newLength = event.data.bufferLength;
                this.playbackBuffer.initialBufferLength = newLength;
                // amazonq-ignore-next-line
                console.log(`Changed initial audio buffer length to: ${newLength}`)
            }
            else if (event.data.type === "barge-in") {
                this.playbackBuffer.clearBuffer();
            }
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0][0]; // Assume one output with one channel
        this.playbackBuffer.read(output);
        return true; // True to continue processing
    }
}

registerProcessor("audio-player-processor", AudioPlayerProcessor);

